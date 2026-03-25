"use client";

/**
 * Official NeuroHire logo from /public/neurohire-logo.png.
 * Pass Tailwind classes for size, e.g. "h-14 w-auto" (sidebar) or "h-36 w-auto max-w-[280px]" (auth).
 */
export default function BrandLogo({
  className = "h-14 w-auto max-h-24",
  alt = "NeuroHire Official",
}) {
  return (
    <img
      src="/neurohire-logo.png"
      alt={alt}
      className={`bg-transparent object-contain object-left ${className}`}
      width={640}
      height={640}
    />
  );
}
