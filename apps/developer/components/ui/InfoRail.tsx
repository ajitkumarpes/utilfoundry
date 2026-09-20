import Link from "next/link";
import {
  Braces, ChevronRight, Clock3, Code2, CreditCard, Eye, KeyRound, Lightbulb, Lock,
  ShieldCheck, Zap, type LucideIcon
} from "lucide-react";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { reasonsFor, relatedTo, tipsFor, type ReasonIcon, type Tone } from "@/lib/tool-content";
import type { ToolDefinition } from "@/lib/tools";

const ICONS: Record<ReasonIcon, LucideIcon> = {
  shield: ShieldCheck,
  lock: Lock,
  zap: Zap,
  eye: Eye,
  clock: Clock3,
  code: Code2,
  key: KeyRound,
  card: CreditCard,
  braces: Braces
};

const TONES: Record<Tone, { color: string; tint: string }> = {
  green: { color: "#16a34a", tint: "var(--green-tint)" },
  blue: { color: "#2f6fed", tint: "var(--blue-tint)" },
  purple: { color: "#7c4dee", tint: "var(--purple-tint)" },
  amber: { color: "#e8912a", tint: "var(--amber-tint)" }
};

/**
 * `showRelated` is false while ResultSummary is showing its own "Next steps" list for the
 * same tool (right above this one, in the same rail) — otherwise the two would repeat each
 * other. It stays true the rest of the time, so related tools are still discoverable before
 * (or without) a run.
 */
export function InfoRail({ tool, showRelated = true }: { tool: ToolDefinition; showRelated?: boolean }) {
  const related = showRelated ? relatedTo(tool) : [];
  return (
    <>
      <section className="card rail-card">
        <h2>Why use this tool?</h2>
        <div className="reason-list">
          {reasonsFor(tool).map((reason) => {
            const Icon = ICONS[reason.icon];
            const tone = TONES[reason.tone];
            return (
              <div className="reason" key={reason.title}>
                <i style={{ background: tone.tint, color: tone.color }}><Icon size={17} aria-hidden /></i>
                <div><strong>{reason.title}</strong><small>{reason.note}</small></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card rail-card">
        <h2 className="rail-title-icon"><Lightbulb size={17} aria-hidden /> Tips for best results</h2>
        <ul className="tip-list">
          {tipsFor(tool).map((tip) => <li key={tip}><ChevronRight size={14} aria-hidden /> {tip}</li>)}
        </ul>
      </section>

      {related.length > 0 && (
        <section className="card rail-card">
          <h2>Related tools</h2>
          <div className="related-list">
            {related.map((item) => (
              <Link key={item.id} href={`/${item.slug}`} className="related-link">
                <i><ToolIcon id={item.id} size={16} /></i>
                <span><b>{item.name}</b><small>{item.tagline}</small></span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
