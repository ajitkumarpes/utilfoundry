"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadFile, loadSample, releaseImage } from "@/lib/canvas/load";
import type { SourceImage } from "@/lib/canvas/types";
import type { Sample } from "@/lib/samples";

/**
 * Owns the selected images for a tool: decoding, ordering, revoking object URLs
 * and surfacing a single human-readable error.
 */
export function useImageInput({ multiple, max = 20 }: { multiple: boolean; max?: number }) {
  const [images, setImages] = useState<SourceImage[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sampleSrc, setSampleSrc] = useState<string>();
  const live = useRef<SourceImage[]>([]);

  // Kept in a ref purely so the unmount cleanup can revoke whatever is current.
  useEffect(() => { live.current = images; }, [images]);
  useEffect(() => () => live.current.forEach(releaseImage), []);

  const addFiles = useCallback(async (files: File[]) => {
    setError("");
    setLoading(true);
    setSampleSrc(undefined);
    const accepted: SourceImage[] = [];
    const problems: string[] = [];

    for (const file of multiple ? files : files.slice(0, 1)) {
      try {
        accepted.push(await loadFile(file));
      } catch (cause) {
        problems.push(cause instanceof Error ? cause.message : `“${file.name}” could not be read.`);
      }
    }

    setImages((current) => {
      if (!multiple) {
        current.forEach(releaseImage);
        return accepted.slice(0, 1);
      }
      const room = Math.max(0, max - current.length);
      if (accepted.length > room) problems.push(`Only ${max} images can be combined at once.`);
      return [...current, ...accepted.slice(0, room)];
    });

    if (problems.length) setError(problems[0]);
    setLoading(false);
    return accepted;
  }, [multiple, max]);

  const addSample = useCallback(async (sample: Sample) => {
    setError("");
    setLoading(true);
    try {
      const image = await loadSample(sample.src, sample.name);
      setSampleSrc(sample.src);
      setImages((current) => {
        if (!multiple) {
          current.forEach(releaseImage);
          return [image];
        }
        return current.length >= max ? current : [...current, image];
      });
      return image;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The sample image could not be loaded.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [multiple, max]);

  const remove = useCallback((id: string) => {
    setImages((current) => {
      const target = current.find((item) => item.id === id);
      releaseImage(target);
      return current.filter((item) => item.id !== id);
    });
    setSampleSrc(undefined);
  }, []);

  const clear = useCallback(() => {
    setImages((current) => { current.forEach(releaseImage); return []; });
    setSampleSrc(undefined);
    setError("");
  }, []);

  const reorder = useCallback((from: number, to: number) => {
    setImages((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  return { images, error, setError, loading, sampleSrc, addFiles, addSample, remove, clear, reorder };
}
