"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Camera, Check, ChevronRight, Clock, Code2, Crop, Eye, FileText, Globe, Image as ImageIcon, Layers,
  Leaf, Lightbulb, Lock, MessageSquareHeart, ScanText, ShieldCheck, SlidersHorizontal, Sparkles, Target,
  WifiOff, Zap, type LucideIcon
} from "lucide-react";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { contentFor, FORMAT_INFO, type FormatId, type Reason, type ReasonIcon, type Tone } from "@/lib/tool-content";
import { getTool, type ToolDefinition, type ToolId } from "@/lib/tools";

const ICONS: Record<ReasonIcon, LucideIcon> = {
  shield: ShieldCheck,
  lock: Lock,
  zap: Zap,
  leaf: Leaf,
  sparkles: Sparkles,
  layers: Layers,
  target: Target,
  eye: Eye,
  clock: Clock,
  offline: WifiOff,
  image: ImageIcon,
  globe: Globe,
  scan: ScanText,
  crop: Crop,
  code: Code2,
  file: FileText,
  camera: Camera,
  sliders: SlidersHorizontal
};

export const TONES: Record<Tone, { color: string; tint: string }> = {
  green: { color: "#16a34a", tint: "var(--green-tint)" },
  blue: { color: "#2f6fed", tint: "var(--blue-tint)" },
  purple: { color: "#7c4dee", tint: "var(--purple-tint)" },
  amber: { color: "#e8912a", tint: "var(--amber-tint)" },
  orange: { color: "#f04e23", tint: "var(--accent-tint)" }
};

export function WhyUseCard({ reasons }: { reasons: Reason[] }) {
  return (
    <section className="card rail-card">
      <h2>Why use this tool?</h2>
      <div className="reason-list">
        {reasons.map((reason) => {
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
  );
}

/** A small document glyph with the format's colour, as in the reference rail. */
function FormatBadge({ id }: { id: FormatId }) {
  const info = FORMAT_INFO[id];
  return (
    <span className="format-badge" title={info.note}>
      <svg width="26" height="30" viewBox="0 0 26 30" aria-hidden>
        <path d="M3 3a3 3 0 0 1 3-3h10l7 7v20a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V3Z" fill={info.color} />
        <path d="M16 0v4a3 3 0 0 0 3 3h4" fill="rgba(255,255,255,.35)" />
        <rect x="8" y="14" width="10" height="7" rx="1.5" fill="rgba(255,255,255,.85)" />
      </svg>
      <small>{info.label}</small>
    </span>
  );
}

export function FormatsCard({ formats, title = "Supported Formats" }: { formats: FormatId[]; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="card rail-card">
      <div className="rail-card-head">
        <h2>{title}</h2>
        <button type="button" className="link-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? "Hide" : "View all"}
        </button>
      </div>
      <div className="format-row">
        {formats.map((id) => <FormatBadge key={id} id={id} />)}
      </div>
      {open && (
        <dl className="format-notes">
          {formats.map((id) => (
            <div key={id}><dt>{FORMAT_INFO[id].label}</dt><dd>{FORMAT_INFO[id].note}</dd></div>
          ))}
        </dl>
      )}
    </section>
  );
}

export function TipsCard({ tips, title = "Tips for best results" }: { tips: string[]; title?: string }) {
  return (
    <section className="card rail-card">
      <h2 className="rail-title-icon"><Lightbulb size={17} aria-hidden /> {title}</h2>
      <ul className="tip-list">
        {tips.map((tip) => <li key={tip}><ChevronRight size={14} aria-hidden /> {tip}</li>)}
      </ul>
    </section>
  );
}

export function UseCasesCard({ items, title = "Common use cases" }: { items: string[]; title?: string }) {
  return (
    <section className="card rail-card">
      <h2>{title}</h2>
      <ul className="check-list">
        {items.map((item) => <li key={item}><Check size={14} strokeWidth={2.6} aria-hidden /> {item}</li>)}
      </ul>
    </section>
  );
}

export function RelatedToolsCard({ ids }: { ids: ToolId[] }) {
  return (
    <section className="card rail-card">
      <h2>Related tools</h2>
      <div className="related-list">
        {ids.map((id) => {
          const related = getTool(id);
          if (!related) return null;
          return (
            <Link key={id} href={`/${id}`} className="related-link">
              <i><ToolIcon id={id} size={16} /></i>
              <span><b>{related.name}</b><small>{related.tagline}</small></span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function FeedbackCard() {
  return (
    <Link href="/contact" className="card feedback-card">
      <i aria-hidden><MessageSquareHeart size={20} /></i>
      <span><b>Have feedback?</b><small>Help us improve our image tools</small></span>
      <ChevronRight size={18} aria-hidden />
    </Link>
  );
}

/**
 * The standard informational rail. Workbenches with options of their own render
 * those first and then this, so the order is always "what to do, then why".
 */
export function InfoRail({ tool, include = ["reasons", "formats", "useCases", "tips", "related", "feedback"] }: {
  tool: ToolDefinition;
  include?: ("reasons" | "formats" | "useCases" | "tips" | "related" | "feedback")[];
}) {
  const content = contentFor(tool.id);
  if (!content) return null;
  const wants = new Set(include);
  return (
    <>
      {wants.has("reasons") && <WhyUseCard reasons={content.reasons} />}
      {wants.has("formats") && content.formats && <FormatsCard formats={content.formats} />}
      {wants.has("useCases") && content.useCases && <UseCasesCard items={content.useCases} />}
      {wants.has("tips") && content.tips && <TipsCard tips={content.tips} />}
      {wants.has("related") && content.related && <RelatedToolsCard ids={content.related} />}
      {wants.has("feedback") && <FeedbackCard />}
    </>
  );
}
