import type { ToolDefinition, ToolId } from "@/lib/tools";

export type ToolOptions = Record<string, string>;

export type ProcessResult = {
  url?: string;
  text?: string;
  name?: string;
  size?: number;
  mime?: string;
  confidence?: number | null;
};

export type ToolNavGroup = {
  label: string;
  ids: ToolId[];
};

export type ToolWithIcon = ToolDefinition;
