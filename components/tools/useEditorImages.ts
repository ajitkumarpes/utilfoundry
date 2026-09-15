"use client";

import { useCallback, useMemo, useState } from "react";
import { useImageInput } from "@/components/tools/useImageInput";
import type { Sample } from "@/lib/samples";

/**
 * The image list behind the single-image editors: several images can be
 * loaded, one is edited at a time, and whatever was added last is shown.
 */
export function useEditorImages(max = 20) {
  const input = useImageInput({ multiple: true, max });
  const { addFiles: add, addSample: addOne } = input;
  const [activeId, setActiveId] = useState<string>();

  const active = useMemo(
    () => input.images.find((image) => image.id === activeId) ?? input.images[0] ?? null,
    [input.images, activeId]
  );

  /** The image after the active one, so "Process Another" can move along the list. */
  const next = useMemo(() => {
    if (!active) return null;
    const index = input.images.findIndex((image) => image.id === active.id);
    return input.images[index + 1] ?? null;
  }, [input.images, active]);

  const addFiles = useCallback(async (files: File[]) => {
    const added = await add(files);
    if (added[0]) setActiveId(added[0].id);
  }, [add]);

  const addSample = useCallback(async (sample: Sample) => {
    const added = await addOne(sample);
    if (added) setActiveId(added.id);
  }, [addOne]);

  return { ...input, addFiles, addSample, active, next, select: setActiveId };
}

export type EditorImages = ReturnType<typeof useEditorImages>;
