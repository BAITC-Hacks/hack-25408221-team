"use client";

// Lazily creates (and caches) a MediaPipe FaceDetector. First call downloads
// the WASM runtime + a small .tflite model from Google's CDN, so it needs
// network access the first time; cached in the browser after that.
import type { FaceDetector as FaceDetectorType } from "@mediapipe/tasks-vision";

let detectorPromise: Promise<FaceDetectorType> | null = null;

export function getFaceDetector(): Promise<FaceDetectorType> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
      );
      return FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
        },
        runningMode: "VIDEO",
      });
    })().catch((error) => {
      detectorPromise = null;
      throw error;
    });
  }
  return detectorPromise;
}

export interface FaceCheckResult {
  ok: boolean;
  reason?: "no_face" | "multiple_faces" | "camera_denied" | "detector_failed";
  detail?: string;
}

/** Waits until the video element actually has a decoded frame ready.
 * `video.play()` resolving is NOT enough — detectForVideo throws if called
 * before the first frame is decoded (readyState < HAVE_CURRENT_DATA). */
function waitForFirstFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Camera did not deliver a frame")), 8000);
    video.addEventListener("loadeddata", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

/** Confirms exactly one face is visible, consistently, for `durationMs`. */
export async function confirmSingleFace(durationMs = 3000, existingStream?: MediaStream): Promise<FaceCheckResult> {
  let stream: MediaStream;
  try {
    stream = existingStream || await navigator.mediaDevices.getUserMedia({ video: true });
  } catch {
    return { ok: false, reason: "camera_denied" };
  }

  const video = document.createElement("video");
  video.style.position = "fixed";
  video.style.left = "-9999px";
  video.style.width = "1px";
  video.style.height = "1px";
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  document.body.appendChild(video);

  try {
    await video.play();
    await waitForFirstFrame(video);
    const detector = await getFaceDetector();

    const start = performance.now();
    let sawZero = false;
    let sawMultiple = false;
    let sawAny = false;
    let framesTried = 0;
    let framesFailed = 0;
    let lastError: unknown = null;

    while (performance.now() - start < durationMs) {
      framesTried++;
      try {
        const result = withDetectorLogging(() => detector.detectForVideo(video, performance.now()));
        const count = result.detections.length;
        if (count === 0) sawZero = true;
        else if (count > 1) sawMultiple = true;
        else sawAny = true;
      } catch (e) {
        // A single bad frame shouldn't fail the whole 3-second check —
        // only report detector_failed if every frame failed.
        framesFailed++;
        lastError = e;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    if (framesTried > 0 && framesFailed === framesTried) {
      return {
        ok: false,
        reason: "detector_failed",
        detail: lastError instanceof Error ? lastError.message : String(lastError),
      };
    }
    if (sawMultiple) return { ok: false, reason: "multiple_faces" };
    if (!sawAny || sawZero) return { ok: false, reason: "no_face" };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "detector_failed", detail: e instanceof Error ? e.message : String(e) };
  } finally {
    if (!existingStream) stream.getTracks().forEach((t) => t.stop());
    video.remove();
  }
}

// TFLite writes this informational startup line to stderr. Next's dev
// overlay treats console.error as a failure. Keep every other error intact,
// and restore the console immediately after the synchronous inference call.
export function withDetectorLogging<T>(run: () => T): T {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (
      args.length === 1 &&
      typeof args[0] === "string" &&
      args[0].trim() === "INFO: Created TensorFlow Lite XNNPACK delegate for CPU."
    ) {
      console.info(args[0]);
    } else {
      original.apply(console, args);
    }
  };
  try {
    return run();
  } finally {
    console.error = original;
  }
}
