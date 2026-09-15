/** "Preserve formatting" off: rejoin wrapped lines into paragraphs, keeping blank-line breaks. */
export function reflow(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s*\n\s*/g, " ").replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}
