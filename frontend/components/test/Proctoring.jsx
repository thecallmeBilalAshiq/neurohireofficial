"use client";

import { useState, useEffect, useRef, useCallback, forwardRef } from "react";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const FACE_DETECTOR_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const FACE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const OBJECT_DETECTOR_MODEL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";

const MAX_VIOLATIONS = 3;
const BOUNDS_MARGIN = 0.2;
const FACE_MIN_SIZE = 0.15;
const FACE_MAX_SIZE = 0.7;
const EYE_BOUNDS_MARGIN = 0.25; // eyes must be in center 50% (0.25–0.75)
const VIOLATION_DEBOUNCE_MS = 2000;
const OBJECT_DETECT_INTERVAL = 15; // run object detection every N frames

// MediaPipe Face Mesh: left eye ~33, right eye ~263 (landmark indices)
const LEFT_EYE_INDEX = 33;
const RIGHT_EYE_INDEX = 263;

const FORBIDDEN_OBJECT_LABELS = [
  "cell phone",
  "mobile phone",
  "phone",
  "cellular",
  "book",
  "laptop",
  "notebook",
  "tv",
  "monitor",
  "remote",
  "keyboard",
  "mouse",
  "handbag",
  "backpack",
];

function isForbiddenObject(categoryName) {
  if (!categoryName || typeof categoryName !== "string") return false;
  const lower = categoryName.toLowerCase();
  return FORBIDDEN_OBJECT_LABELS.some((label) => lower.includes(label));
}

export default forwardRef(function Proctoring(
  {
    onTabSwitch,
    onFaceStatusChange,
    onMaxViolations,
    disabled = false,
    mcqMode = false,
  },
  ref
) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceDetectorRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const objectDetectorRef = useRef(null);
  const visionRef = useRef(null);
  const rafRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastViolationTimeRef = useRef(0);

  const [cameraError, setCameraError] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceInBounds, setFaceInBounds] = useState(true);
  const [eyesInFrame, setEyesInFrame] = useState(true);
  const [singleFace, setSingleFace] = useState(true);
  const [forbiddenObjectDetected, setForbiddenObjectDetected] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [detectorReady, setDetectorReady] = useState(false);

  const notifyFaceStatus = useCallback(
    (detected) => {
      if (typeof onFaceStatusChange === "function") {
        onFaceStatusChange(detected);
      }
    },
    [onFaceStatusChange]
  );

  const notifyMaxViolations = useCallback(() => {
    if (typeof onMaxViolations === "function") {
      onMaxViolations();
    }
  }, [onMaxViolations]);

  const recordViolation = useCallback(() => {
    const now = Date.now();
    if (now - lastViolationTimeRef.current < VIOLATION_DEBOUNCE_MS) return;
    lastViolationTimeRef.current = now;
    setViolationCount((prev) => {
      const next = prev + 1;
      if (next >= MAX_VIOLATIONS) {
        setTimeout(() => notifyMaxViolations(), 0);
      }
      return next;
    });
  }, [notifyMaxViolations]);

  useEffect(() => {
    if (disabled || typeof onTabSwitch !== "function") return;
    const handleVisibility = () => {
      if (document.hidden) onTabSwitch();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [disabled, onTabSwitch]);

  // Camera + load all models (Face Detector, Face Landmarker, Object Detector)
  useEffect(() => {
    if (disabled) return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const { FilesetResolver, FaceDetector, FaceLandmarker, ObjectDetector } =
          await import("@mediapipe/tasks-vision");
        if (cancelled) return;
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        if (cancelled) return;
        visionRef.current = vision;

        const [faceDetector, faceLandmarker, objectDetector] = await Promise.all([
          FaceDetector.createFromOptions(vision, {
            baseOptions: { modelAssetPath: FACE_DETECTOR_MODEL },
            runningMode: "VIDEO",
            minDetectionConfidence: 0.5,
          }),
          FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL },
            runningMode: "VIDEO",
            numFaces: 1,
            minFaceDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          }),
          ObjectDetector.createFromOptions(vision, {
            baseOptions: { modelAssetPath: OBJECT_DETECTOR_MODEL },
            runningMode: "VIDEO",
            minDetectionConfidence: 0.5,
            maxResults: 10,
          }),
        ]);
        if (cancelled) return;
        faceDetectorRef.current = faceDetector;
        faceLandmarkerRef.current = faceLandmarker;
        objectDetectorRef.current = objectDetector;
        setDetectorReady(true);
      } catch (err) {
        if (!cancelled) {
          console.warn("Proctoring init failed:", err);
          setCameraError("Camera or proctoring failed. Please allow camera access.");
          setFaceDetected(true);
          notifyFaceStatus(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      faceDetectorRef.current = null;
      faceLandmarkerRef.current = null;
      objectDetectorRef.current = null;
      visionRef.current = null;
      setDetectorReady(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [disabled, notifyFaceStatus]);

  // Detection loop: face count, face bounds, eyes in frame, forbidden objects
  useEffect(() => {
    if (disabled || !faceDetectorRef.current || !videoRef.current) return;

    const video = videoRef.current;
    const ts = () => performance.now();

    const runDetection = () => {
      if (!faceDetectorRef.current || !videoRef.current || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(runDetection);
        return;
      }

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) {
        rafRef.current = requestAnimationFrame(runDetection);
        return;
      }

      frameCountRef.current += 1;
      const runObjectDetection = frameCountRef.current % OBJECT_DETECT_INTERVAL === 0;

      try {
        const faceResult = faceDetectorRef.current.detectForVideo(video, ts());
        const faceDetections = faceResult?.detections ?? [];
        const faceCount = faceDetections.length;

        setFaceDetected(faceCount >= 1);
        notifyFaceStatus(faceCount >= 1);

        if (faceCount === 0) {
          setFaceInBounds(true);
          setEyesInFrame(true);
          setSingleFace(true);
        } else if (faceCount > 1) {
          setSingleFace(false);
          setFaceInBounds(true);
          setEyesInFrame(true);
          recordViolation();
        } else {
          setSingleFace(true);
          const box = faceDetections[0].boundingBox;
          if (box) {
            const cx = (box.originX ?? 0) + (box.width ?? 0) / 2;
            const cy = (box.originY ?? 0) + (box.height ?? 0) / 2;
            const inX = cx >= w * BOUNDS_MARGIN && cx <= w * (1 - BOUNDS_MARGIN);
            const inY = cy >= h * BOUNDS_MARGIN && cy <= h * (1 - BOUNDS_MARGIN);
            const faceW = (box.width ?? 0) / w;
            const faceH = (box.height ?? 0) / h;
            const sizeOk =
              faceW >= FACE_MIN_SIZE &&
              faceW <= FACE_MAX_SIZE &&
              faceH >= FACE_MIN_SIZE &&
              faceH <= FACE_MAX_SIZE;
            const boundsOk = inX && inY && sizeOk;
            setFaceInBounds(boundsOk);
            if (!boundsOk) recordViolation();
          } else {
            setFaceInBounds(true);
          }

          // Eyes in frame via Face Landmarker (normalized 0–1)
          if (faceLandmarkerRef.current) {
            try {
              const landmarkResult = faceLandmarkerRef.current.detectForVideo(video, ts());
              const landmarks = landmarkResult?.faceLandmarks?.[0];
              if (landmarks && landmarks.length > Math.max(LEFT_EYE_INDEX, RIGHT_EYE_INDEX)) {
                const left = landmarks[LEFT_EYE_INDEX];
                const right = landmarks[RIGHT_EYE_INDEX];
                const lx = left?.x ?? 0.5;
                const ly = left?.y ?? 0.5;
                const rx = right?.x ?? 0.5;
                const ry = right?.y ?? 0.5;
                const eyeMargin = EYE_BOUNDS_MARGIN;
                const inRange = (v) => v >= eyeMargin && v <= 1 - eyeMargin;
                const eyesOk = inRange(lx) && inRange(ly) && inRange(rx) && inRange(ry);
                setEyesInFrame(eyesOk);
                if (!eyesOk) recordViolation();
              } else {
                setEyesInFrame(true);
              }
            } catch (_) {
              setEyesInFrame(true);
            }
          } else {
            setEyesInFrame(true);
          }
        }

        // Object detection: phone, book, laptop, etc.
        if (runObjectDetection && objectDetectorRef.current) {
          try {
            const objResult = objectDetectorRef.current.detectForVideo(video, ts());
            const detections = objResult?.detections ?? [];
            const forbidden = detections.some(
              (d) =>
                d.categories?.some(
                  (c) => (c.score ?? 0) >= 0.5 && isForbiddenObject(c.categoryName ?? c.displayName)
                )
            );
            setForbiddenObjectDetected(forbidden);
            if (forbidden) recordViolation();
          } catch (_) {
            setForbiddenObjectDetected(false);
          }
        }
      } catch (e) {
        setFaceDetected(false);
        notifyFaceStatus(false);
        setEyesInFrame(true);
        setForbiddenObjectDetected(false);
      }

      rafRef.current = requestAnimationFrame(runDetection);
    };

    rafRef.current = requestAnimationFrame(runDetection);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [disabled, detectorReady, notifyFaceStatus, recordViolation]);

  if (disabled) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {cameraError && (
        <div className="bg-red-600 text-white px-3 py-2 rounded-lg shadow text-sm">
          {cameraError}
        </div>
      )}
      <div className="bg-slate-800 rounded-lg border-2 border-slate-600 overflow-hidden shadow-xl">
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-48 h-36 object-cover block"
          style={{ transform: "scaleX(-1)" }}
        />
        <div className="px-2 py-1 text-xs text-slate-300 space-y-0.5">
          <div>
            {faceDetected
              ? singleFace
                ? "1 face • OK"
                : "Multiple faces!"
              : "Position your face in view"}
          </div>
          {(!faceInBounds || !eyesInFrame) && faceDetected && (
            <div className="text-amber-400">
              Keep face & eyes in frame
            </div>
          )}
          {forbiddenObjectDetected && (
            <div className="text-red-400">No phones or other devices</div>
          )}
          {violationCount > 0 && (
            <div className="text-amber-400">
              Warnings: {violationCount}/{MAX_VIOLATIONS}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
