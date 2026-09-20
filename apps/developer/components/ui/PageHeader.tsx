"use client";

import Link from "next/link";
import { CreditCard, Lock, ShieldCheck, Star, Zap } from "lucide-react";
import { ACCENTS, ToolIcon } from "@/components/ui/ToolIcon";
import { PARENT_URL } from "@/lib/links";
import { useFavorites } from "@/lib/tool-prefs";
import { highlightsFor, type ToolDefinition } from "@/lib/tools";

/** Picks the chip glyph from its wording, so tool definitions stay plain data. */
function chipIcon(text: string) {
  const value = text.toLowerCase();
  if (value.includes("card") || value.includes("masked")) return { icon: <CreditCard size={15} />, color: "#b98215", tint: "var(--amber-tint)" };
  if (value.includes("account")) return { icon: <Lock size={15} />, color: "#2f6fed", tint: "var(--blue-tint)" };
  if (value.includes("browser") || value.includes("upload") || value.includes("tab")) return { icon: <Zap size={15} />, color: "#7c4dee", tint: "var(--purple-tint)" };
  return { icon: <ShieldCheck size={15} />, color: "#16a34a", tint: "var(--green-tint)" };
}

export function PageHeader({ tool }: { tool: ToolDefinition }) {
  const accent = ACCENTS[tool.accent];
  const { favorites, toggle } = useFavorites();
  const isFavorite = favorites.includes(tool.id);

  return (
    <>
      <div className="crumb-row">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <a href={PARENT_URL}>UtilFoundry</a>
          <span aria-hidden>/</span>
          <Link href="/">Developer tools</Link>
          <span aria-hidden>/</span>
          <span aria-current="page">{tool.name}</span>
        </nav>
        <div className="crumb-row-actions">
          <button
            type="button"
            className={`favorite-toggle${isFavorite ? " is-active" : ""}`}
            onClick={() => toggle(tool.id)}
            aria-pressed={isFavorite}
          >
            <Star size={15} fill={isFavorite ? "currentColor" : "none"} />
            {isFavorite ? "Favorited" : "Add to favorites"}
          </button>
          <span className="processing-pill" title="Processed in your browser. Nothing is uploaded and nothing is stored.">
            <i aria-hidden />
            Runs locally
          </span>
        </div>
      </div>

      <div className="tool-hero">
        <span className="tool-hero-icon" style={{ background: accent.tint, color: accent.color }}>
          <ToolIcon id={tool.id} size={30} strokeWidth={1.8} />
        </span>
        <div>
          <h1>{tool.name}</h1>
          <p>{tool.description}</p>
        </div>
      </div>

      <div className="trust-row">
        {highlightsFor(tool).map((item) => {
          const chip = chipIcon(item);
          return (
            <span className="trust-chip" key={item}>
              <i style={{ background: chip.tint, color: chip.color }}>{chip.icon}</i>
              {item}
            </span>
          );
        })}
      </div>
    </>
  );
}
