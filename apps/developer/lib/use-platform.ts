"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Whether shortcut hints should read ⌘ or Ctrl. The server renders the Mac form, and the
 * client corrects it after hydration, so the markup never mismatches.
 */
export function useIsMac() {
  return useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent),
    () => true
  );
}
