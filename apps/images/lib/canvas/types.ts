export type SourceImage = {
  id: string;
  name: string;
  size: number;
  type: string;
  /** Object URL (files) or path (samples); safe to use directly in <img src>. */
  url: string;
  width: number;
  height: number;
  element: HTMLImageElement;
  /** Absent for built-in samples, which are fetched rather than picked. */
  file?: File;
};

export type ToolOptions = Record<string, string | number | boolean>;

export type EncodeFormat = "image/png" | "image/jpeg" | "image/webp";
