/**
 * Screen capture for Screenshot to PDF.
 *
 * The browser always shows its own picker — a page can never capture the
 * screen silently. `surface` is only a hint for which kind of source the picker
 * offers first.
 */

import { context, createCanvas } from "@/lib/canvas/effects";
import { canvasToBlob } from "@/lib/canvas/encode";

export type CaptureSurface = "monitor" | "window" | "browser";

/** Raised when the user closes the picker; not an error worth alarming anyone over. */
export class CaptureCancelled extends Error {}

export function canCapture() {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

function stamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/** Asks for a screen, window or tab, grabs one frame as a PNG, and stops sharing at once. */
export async function captureScreen(surface: CaptureSurface): Promise<File> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: surface },
      audio: false,
      // Offering this very tab would only capture the capture controls.
      selfBrowserSurface: "exclude",
      surfaceSwitching: "exclude"
    } as DisplayMediaStreamOptions);
  } catch (cause) {
    if (cause instanceof DOMException && (cause.name === "NotAllowedError" || cause.name === "AbortError")) {
      throw new CaptureCancelled("Screen capture was cancelled.");
    }
    throw cause;
  }

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    // The first decoded frame can still be blank; wait until one is actually presented.
    await new Promise<void>((resolve) => {
      if (typeof video.requestVideoFrameCallback === "function") video.requestVideoFrameCallback(() => resolve());
      else window.setTimeout(resolve, 300);
    });
    const canvas = createCanvas(video.videoWidth, video.videoHeight);
    context(canvas).drawImage(video, 0, 0);
    const blob = await canvasToBlob(canvas, "image/png", 100);
    return new File([blob], `screenshot-${stamp()}.png`, { type: "image/png" });
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}
