import type { JsonErrorLocation } from "./json-error";
import type { ResultTone } from "./result-summary";

/** A run that produced output — including a validator's negative verdict ("warning"). */
export type RunSuccess = {
  status: "success";
  tone: ResultTone;
  title: string;
  note: string;
  elapsedMs: number;
  inputBytes: number;
  option: string;
};

/** A run the tool could not complete: bad input, a parse error, an unsupported value. */
export type RunFailure = {
  status: "error";
  title: string;
  message: string;
  /** The parser's own wording, kept when `message` is a plain-words explanation of it. */
  detail?: string;
  location: JsonErrorLocation | null;
};

export type RunResult = RunSuccess | RunFailure;
