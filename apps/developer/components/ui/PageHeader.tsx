"use client";

import Link from "next/link";
import { ChevronRight, House, Lock, Monitor, Share2, Star, Zap } from "lucide-react";
import { ACCENTS, ToolIcon } from "@/components/ui/ToolIcon";
import { PARENT_URL } from "@/lib/links";
import { useFavorites } from "@/lib/tool-prefs";
import type { ToolDefinition } from "@/lib/tools";

type Notify = (text: string, tone?: "success" | "info") => void;

export function ToolCrumbs({ tool, notify }: { tool: ToolDefinition; notify: Notify }) {
  const { favorites, toggle } = useFavorites();
  const isFavorite = favorites.includes(tool.id);

  async function share() {
    const url = window.location.href;
    // The share sheet is what a phone user expects; on a desktop it is usually a detour.
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: `${tool.name} — UtilFoundry`, url });
      } catch {
        // Dismissing the share sheet is not an error worth reporting.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      notify("Link copied to clipboard");
    } catch {
      notify("Copy the address from the address bar to share this tool", "info");
    }
  }

  return (
    <div className="crumb-row">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a href={PARENT_URL} className="crumb-home" aria-label="UtilFoundry home"><House size={16} aria-hidden /></a>
        <ChevronRight size={15} aria-hidden className="crumb-sep" />
        <Link href="/tools">Developer tools</Link>
        <ChevronRight size={15} aria-hidden className="crumb-sep" />
        <span aria-current="page">{tool.name}</span>
      </nav>
      <div className="crumb-actions">
        <button
          type="button"
          className={`btn btn-outline btn-chip favorite-toggle${isFavorite ? " is-active" : ""}`}
          onClick={() => {
            toggle(tool.id);
            notify(isFavorite ? "Removed from favorites" : "Added to favorites");
          }}
          aria-pressed={isFavorite}
        >
          <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
          {isFavorite ? "Favorited" : "Add to favorites"}
        </button>
        <button type="button" className="btn btn-outline btn-chip" onClick={share}>
          <Share2 size={16} /> Share
        </button>
      </div>
    </div>
  );
}

/** A filled shield with the check knocked out, as the design draws it; lucide only has the outline. */
function FilledShieldCheck({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
      />
      <path d="m9 12 2 2 4-4" fill="none" stroke="var(--panel)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const CHIPS = [
  { label: "100% Free", icon: FilledShieldCheck, tone: "green" },
  { label: "No account required", icon: Lock, tone: "blue" },
  { label: "Runs in your browser", icon: Zap, tone: "purple" },
  { label: "No data is uploaded", icon: Monitor, tone: "blue" }
] as const;

export function ToolHero({ tool }: { tool: ToolDefinition }) {
  const accent = ACCENTS[tool.accent];
  return (
    <>
      <div className="tool-hero">
        <span className="tool-hero-icon" style={{ background: accent.tint, color: accent.ink }}>
          <ToolIcon id={tool.id} size={34} strokeWidth={1.8} />
        </span>
        <div>
          <h1>{tool.name}</h1>
          <p>{tool.description}</p>
        </div>
      </div>
      <ul className="trust-row" aria-label="About this tool">
        {CHIPS.map(({ label, icon: Icon, tone }) => (
          <li className="trust-chip" key={label}>
            {Icon === Zap
              ? <Zap size={18} className={`chip-icon tone-${tone}`} fill="currentColor" aria-hidden />
              : <Icon size={18} className={`chip-icon tone-${tone}`} aria-hidden />}
            {label}
          </li>
        ))}
      </ul>
    </>
  );
}
