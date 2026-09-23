"use client";

import { forwardRef } from "react";
import { BookOpen, X } from "lucide-react";
import { ToolIcon, ACCENTS } from "@/components/ui/ToolIcon";
import { guideFor } from "@/lib/tool-guide";
import { tipsFor } from "@/lib/tool-content";
import { inputLanguage, optionsFor, outputNoun } from "@/lib/tool-options";
import { defaultOption } from "@/lib/samples";
import { useIsMac } from "@/lib/use-platform";
import type { ToolDefinition } from "@/lib/tools";

/**
 * The "View full documentation" page for a tool, as a dialog: everything a first-time user
 * needs — what goes in, what each setting does, what comes out, shortcuts and tips — built
 * from the same data that drives the page, so it cannot drift from what the tool does.
 */
export const DocsDialog = forwardRef<HTMLDialogElement, { tool: ToolDefinition }>(function DocsDialog({ tool }, ref) {
  const guide = guideFor(tool.id);
  const options = optionsFor(tool.id);
  const accent = ACCENTS[tool.accent];
  const needsInput = tool.inputLabel !== "Not needed";
  const isMac = useIsMac();
  const modifier = isMac ? "⌘" : "Ctrl";
  const close = () => (ref && "current" in ref ? ref.current?.close() : undefined);

  return (
    <dialog ref={ref} className="docs-dialog" aria-labelledby={`docs-${tool.id}-title`}>
      <div className="docs-head">
        <span className="docs-icon" style={{ background: accent.tint, color: accent.ink }}>
          <ToolIcon id={tool.id} size={22} />
        </span>
        <div>
          <p className="docs-eyebrow"><BookOpen size={13} aria-hidden /> Documentation</p>
          <h2 id={`docs-${tool.id}-title`}>{tool.name}</h2>
        </div>
        <button type="button" className="docs-close" onClick={close} aria-label="Close documentation">
          <X size={18} />
        </button>
      </div>

      <div className="docs-body">
        <section>
          <h3>Overview</h3>
          <p>{tool.description}</p>
          {guide && <p>{guide.why}</p>}
        </section>

        <section>
          <h3>How to use it</h3>
          <ol>
            {needsInput ? (
              <li>
                Paste or type your {inputLanguage(tool.id, defaultOption(tool.id))} into <b>Input</b>, drop a file onto it,
                or press <b>Example</b> to load a sample.
              </li>
            ) : (
              <li>This tool needs no input.</li>
            )}
            {options && <li>Choose the settings in the <b>{options.title}</b> bar under the editors.</li>}
            <li>Press <b>Run tool</b>, or <kbd>{modifier} ↵</kbd> from anywhere on the page.</li>
            <li>Read the result in <b>Output</b>, then copy or download it. The <b>Result</b> tab has size, line counts and next steps.</li>
          </ol>
        </section>

        {needsInput && (
          <section>
            <h3>Input</h3>
            <p>{tool.inputLabel}.{tool.inputHint ? ` ${tool.inputHint}` : ""}</p>
          </section>
        )}

        {options && (
          <section>
            <h3>Settings</h3>
            <ul>
              {options.controls.map((control) => (
                <li key={control.field}>
                  <b>{control.label}</b>
                  {control.kind === "text"
                    ? control.placeholder ? ` — for example ${control.placeholder}` : ""
                    : ` — ${control.choices.map((choice) => choice.label).join(", ")}`}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3>Output</h3>
          <p>{outputNoun(tool.id, defaultOption(tool.id))}.</p>
          {guide && (
            <ul>
              {guide.features.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
          )}
        </section>

        <section>
          <h3>Tips</h3>
          <ul>
            {tipsFor(tool).map((tip) => <li key={tip}>{tip}</li>)}
          </ul>
        </section>

        <section>
          <h3>Keyboard shortcuts</h3>
          <dl className="docs-shortcuts">
            <div><dt><kbd>{modifier} ↵</kbd></dt><dd>Run the tool</dd></div>
            <div><dt><kbd>{modifier} K</kbd></dt><dd>Search every tool</dd></div>
            <div><dt><kbd>/</kbd></dt><dd>Filter the sidebar</dd></div>
          </dl>
        </section>
      </div>
    </dialog>
  );
});
