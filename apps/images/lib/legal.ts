/**
 * The facts the privacy policy and terms state, in one place.
 *
 * The three tool lists are derived from the catalogue rather than written out, so a
 * tool cannot be added to the app without appearing in the right paragraph of the
 * privacy policy. `tests/legal.test.ts` fails if a new engine appears that this file
 * has not classified.
 */
import { READY_TOOLS, type ToolDefinition, type ToolEngine } from "@/lib/tools";

export const OPERATOR = "UtilFoundry";
export const GOVERNING_LAW = "India";
export const LAST_UPDATED = "17 September 2026";

/** Engines that send the file to a UtilFoundry server. Every other engine stays in the tab. */
export const SERVER_ENGINES: ToolEngine[] = ["server", "worker"];

const names = (match: (tool: ToolDefinition) => boolean) => READY_TOOLS.filter(match).map((tool) => tool.name);

/** Re-encoded by Sharp inside this app's own Next.js server. */
export const SHARP_TOOL_NAMES = names((tool) => tool.engine === "server");

/** Passed on to the OCR and model worker that runs beside it on the same private network. */
export const WORKER_TOOL_NAMES = names((tool) => tool.engine === "worker");

/** Never leave the browser, unless AVIF or TIFF output is chosen. */
export const BROWSER_TOOL_NAMES = names((tool) => !SERVER_ENGINES.includes(tool.engine));
