# Proctoring & MediaPipe — Implementation Guide (NeuroHire)

This document explains **how online test proctoring is implemented** in NeuroHire: architecture, **MediaPipe Tasks Vision** usage, model URLs, API parameters, project-specific thresholds, and integration with the test flow.

**Primary source file:** `frontend/components/test/Proctoring.jsx`  
**Integration:** `frontend/app/test/take/page.js`  
**Backend touchpoints:** `backend/controllers/testController.js`, `backend/models/TestAttempt.js`

---

## Table of contents

1. [What the proctoring module does](#1-what-the-proctoring-module-does)
2. [How MediaPipe is included](#2-how-mediapipe-is-included)
3. [Models used and where they are hosted](#3-models-used-and-where-they-are-hosted)
4. [Camera pipeline](#4-camera-pipeline)
5. [Creating the three MediaPipe tasks](#5-creating-the-three-mediapipe-tasks)
   - [FaceDetector](#51-facedetector)
   - [FaceLandmarker](#52-facelandmarker)
   - [ObjectDetector](#53-objectdetector-efficientdet-lite0)
6. [Project-specific tuning constants](#6-project-specific-tuning-constants)
7. [Detection loop: timestamps and requestAnimationFrame](#7-detection-loop-timestamps-and-requestanimationframe)
8. [Violation counting and parent page behavior](#8-violation-counting-and-parent-page-behavior)
9. [Non-MediaPipe proctoring (tab visibility)](#9-non-mediapipe-proctoring-tab-visibility)
10. [Failure mode (camera / models)](#10-failure-mode-camera--models)
11. [Backend linkage](#11-backend-linkage)
12. [Tuning guide](#12-tuning-guide)

---

## 1. What the proctoring module does

**Role:** While a candidate takes the online test, the app runs **continuous checks** in the browser:

- Live **camera** feed
- **Face** presence, count, position, and approximate size
- **Eyes** roughly in the central area of the frame (via face landmarks)
- **Forbidden objects** (e.g. phone, laptop) via object detection
- **Tab switching** via the Page Visibility API

If rules are broken **repeatedly** (per configured thresholds), the app **submits the test as disqualified** so the attempt is **not scored** for ranking.

**Important:** Inference runs **entirely on the client** (browser + WebAssembly). The server learns the outcome when the client **saves** or **submits** (e.g. `proctoringDisqualification: true`).

| Piece | Location |
|--------|-----------|
| UI + MediaPipe logic | `frontend/components/test/Proctoring.jsx` |
| Callbacks, warm-up timer, submit wiring | `frontend/app/test/take/page.js` |
| Submit / optional events | `backend/controllers/testController.js` |
| Schema | `backend/models/TestAttempt.js` (`proctoringEvents`, etc.) |

---

## 2. How MediaPipe is included

NeuroHire uses Google’s **JavaScript Tasks Vision** API via npm:

- Package: **`@mediapipe/tasks-vision`** (see `frontend/package.json`, e.g. `^0.10.32`).

The component **dynamic-imports** the library so it loads only when the test UI needs it:

```javascript
const { FilesetResolver, FaceDetector, FaceLandmarker, ObjectDetector } =
  await import("@mediapipe/tasks-vision");
```

**WASM runtime** is loaded from a CDN (not copied into the repo):

```javascript
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
```

`FilesetResolver.forVisionTasks(WASM_URL)` initializes the WASM engine that executes the `.tflite` / `.task` models in the browser.

---

## 3. Models used and where they are hosted

Three **official MediaPipe model assets** are referenced by **HTTPS URL** (downloaded at runtime):

| Task | Constant | Asset | Purpose |
|------|----------|--------|---------|
| Face detection | `FACE_DETECTOR_MODEL` | `blaze_face_short_range.tflite` | Fast **face bounding boxes** and **face count** (0 / 1 / many). |
| Face landmarks | `FACE_LANDMARKER_MODEL` | `face_landmarker.task` | **468-style** facial landmarks; used here for **eye region** checks. |
| Object detection | `OBJECT_DETECTOR_MODEL` | `efficientdet_lite0.tflite` | Lightweight **object detector**; labels mapped to COCO-like categories. |

**URLs in code:**

```
https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite
https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite
```

**Why both Face Detector and Face Landmarker?**

- **Detector:** cheap, stable **boxes** and **count**.
- **Landmarker:** finer **geometry** for rules like “eyes stay in the central band” using normalized landmark coordinates.

---

## 4. Camera pipeline

Before models run, the app requests video:

```javascript
navigator.mediaDevices.getUserMedia({
  video: { width: 640, height: 480, facingMode: "user" },
  audio: false,
})
```

- **640×480** is requested; actual resolution may vary by device.
- **`facingMode: "user"`** selects the front camera when available.
- **No audio** reduces permission scope.

The stream is attached to a `<video>` element. MediaPipe calls use:

```javascript
task.detectForVideo(video, timestampMs)
```

The preview is **mirrored** with CSS (`transform: scaleX(-1)`) for a natural selfie view; detection uses the underlying video frame.

---

## 5. Creating the three MediaPipe tasks

All tasks are created with `Task.createFromOptions(vision, options)` where `vision` comes from `FilesetResolver.forVisionTasks(WASM_URL)`.

### 5.1 FaceDetector

```javascript
FaceDetector.createFromOptions(vision, {
  baseOptions: { modelAssetPath: FACE_DETECTOR_MODEL },
  runningMode: "VIDEO",
  minDetectionConfidence: 0.5,
})
```

| Option | Value | Meaning |
|--------|--------|--------|
| `baseOptions.modelAssetPath` | Blaze Face Short Range URL | Selfie / webcam-oriented short-range model. |
| `runningMode` | `"VIDEO"` | Use **`detectForVideo`** for streaming frames. |
| `minDetectionConfidence` | `0.5` | Detections below 0.5 are discarded. **Higher** → fewer false faces, more misses in poor light. **Lower** → more detections, more false positives. |

**Output used:** `detections[]` with `boundingBox` (`originX`, `originY`, `width`, `height`) in **pixels**.

---

### 5.2 FaceLandmarker

```javascript
FaceLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL },
  runningMode: "VIDEO",
  numFaces: 1,
  minFaceDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
})
```

| Option | Value | Meaning |
|--------|--------|--------|
| `runningMode` | `"VIDEO"` | Streaming mode. |
| `numFaces` | `1` | Track at most one face (fits single-candidate proctoring). |
| `minFaceDetectionConfidence` | `0.5` | Initial face detection threshold inside the pipeline. |
| `minTrackingConfidence` | `0.5` | Tracking stability across frames. |

**Output used:** `faceLandmarks[0]` — array of `{ x, y, z }` in **normalized** coordinates (typically **0–1** relative to image width/height).

**Eye landmark indices in this project:**

```javascript
const LEFT_EYE_INDEX = 33;
const RIGHT_EYE_INDEX = 263;
```

These indices follow the **468-point** topology familiar from legacy “Face Mesh” documentation; the modern API is **Face Landmarker**, not the old `FaceMesh` class name.

---

### 5.3 ObjectDetector (EfficientDet Lite0)

```javascript
ObjectDetector.createFromOptions(vision, {
  baseOptions: { modelAssetPath: OBJECT_DETECTOR_MODEL },
  runningMode: "VIDEO",
  minDetectionConfidence: 0.5,
  maxResults: 10,
})
```

| Option | Value | Meaning |
|--------|--------|--------|
| `runningMode` | `"VIDEO"` | Streaming mode. |
| `minDetectionConfidence` | `0.5` | Minimum score for a detection. |
| `maxResults` | `10` | Cap detections per frame (enough for scene screening). |

**Output used:** `detections` with `categories[]` (`categoryName` / `displayName`, `score`).

**Performance:** Object detection runs **every N frames** (`OBJECT_DETECT_INTERVAL = 15`), not every frame. Face detector + landmarker run **every** frame in the loop.

---

## 6. Project-specific tuning constants

These are **NeuroHire policy** values, not MediaPipe defaults:

| Constant | Typical value | Role |
|----------|----------------|------|
| `MAX_VIOLATIONS` | `3` | After this many **debounced** violations, `onMaxViolations()` fires → parent submits as disqualified. |
| `BOUNDS_MARGIN` | `0.2` | Face **center** must lie within the middle **60%** of width and height (between 0.2 and 0.8 of frame). |
| `FACE_MIN_SIZE` | `0.15` | Face box width/height vs frame must be ≥ 15% (not too far / too small). |
| `FACE_MAX_SIZE` | `0.7` | Face box must be ≤ 70% of frame (not absurdly close / wrong framing). |
| `EYE_BOUNDS_MARGIN` | `0.25` | Each eye landmark **x** and **y** must be in **[0.25, 0.75]** — “eyes in central half” of the frame. |
| `VIOLATION_DEBOUNCE_MS` | `2000` | At most **one** counted violation per **2 seconds** to avoid spamming strikes on noisy frames. |

**Forbidden object labels** (substring match, case-insensitive): e.g. `cell phone`, `mobile phone`, `laptop`, `book`, `keyboard`, `mouse`, etc. A detection counts if **any category** has `score >= 0.5` and the name matches.

---

## 7. Detection loop: timestamps and requestAnimationFrame

The loop is driven by **`requestAnimationFrame`**.

MediaPipe **VIDEO** mode expects a **strictly increasing** timestamp in milliseconds. The project uses:

```javascript
const getFrameTimestamp = () => {
  const t = Math.max(performance.now(), lastTimestampRef.current + 1);
  lastTimestampRef.current = t;
  return t;
};
```

This avoids duplicate or decreasing timestamps, which can break some delegates.

**Per frame (simplified):**

1. Wait until `video.readyState >= 2` and dimensions are valid.
2. **FaceDetector** → face count, bounding box checks → optional `recordViolation()`.
3. If **exactly one** face → **FaceLandmarker** → eye position checks → optional `recordViolation()`.
4. Every **15th** frame → **ObjectDetector** → forbidden object check → optional `recordViolation()`.
5. Schedule the next frame.

---

## 8. Violation counting and parent page behavior

- **`recordViolation`:** respects debounce; increments counter; when `count >= MAX_VIOLATIONS`, calls **`onMaxViolations()`**.

**`frontend/app/test/take/page.js`:**

- **`onMaxViolations`** → submits test with **`proctoringDisqualification: true`** (disqualified, no score).
- **`onTabSwitch`** → first visibility loss: pause UI; **second** time: same disqualified submit path.
- **`onFaceStatusChange`** → drives “face must be visible” gating (timer / overlays) after warm-up.
- **`enableDetection={prepComplete}`** → delays running `detectForVideo` for ~12.5s so WASM/models can load with fewer errors.
- **`compactTop`** → UI only: smaller camera preview position during coding section.

---

## 9. Non-MediaPipe proctoring (tab visibility)

```javascript
document.addEventListener("visibilitychange", () => {
  if (document.hidden) onTabSwitch();
});
```

Leaving the tab triggers the same **tab-switch policy** as implemented in the parent (warning, then disqualifying submit on repeat).

---

## 10. Failure mode (camera / models)

If initialization fails (permission denied, WASM error, etc.), the UI shows an error but also sets **face detected** to allow the candidate to proceed **without** being stuck on a blocking overlay forever (degraded proctoring). Adjust this behavior if you require hard failure when the camera cannot start.

---

## 11. Backend linkage

- **`POST .../submit`** with `proctoringDisqualification: true` → attempt marked **`disqualified`**, invitation updated, **no** LLM scoring path for ranking.
- **`PUT .../attempt`** (`saveProgress`) can accept `proctoringEvent` / `violationCount` for auditing; **auto-disqualification purely from `violationCount` on save** is not relied on for the main flow (explicit submit flag is authoritative for DQ).
- HR / pipeline UIs treat **disqualified** attempts as **not ranked** / not eligible for interview shortlist by test score.

---

## 12. Tuning guide

| Goal | Suggestion |
|------|------------|
| **Stricter** | Tighten `BOUNDS_MARGIN` / eye margins; lower `minDetectionConfidence` slightly (more detections, but tune carefully); lower `MAX_VIOLATIONS`. |
| **Looser** | Widen margins; raise `minDetectionConfidence`; increase `VIOLATION_DEBOUNCE_MS` or `MAX_VIOLATIONS`. |
| **Faster / less CPU** | Increase `OBJECT_DETECT_INTERVAL`; consider running landmarker every 2nd frame (code change). |
| **Better object detection** | Heavier MediaPipe object models (trade FPS). |

---

## References

- MediaPipe Tasks Vision (JS): bundled with `@mediapipe/tasks-vision`
- Model buckets: `https://storage.googleapis.com/mediapipe-models/`
- In-repo implementation: `frontend/components/test/Proctoring.jsx`

---

*Document generated for the NeuroHire project. Update constants and file paths if the codebase changes.*
