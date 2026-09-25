"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, LayoutTemplate, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SinglePdfInput from "@/components/SinglePdfInput";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8091";

type ZoneType = "NONE" | "TEXT" | "PAGE_NUMBER" | "DATE" | "BATES";
type ZoneKey = "topLeft" | "topCenter" | "topRight" | "bottomLeft" | "bottomCenter" | "bottomRight";

type ZoneState = {
  type: ZoneType;
  text: string;
  batesPrefix: string;
  batesDigits: string;
  batesStart: string;
};

const emptyZone: ZoneState = { type: "NONE", text: "", batesPrefix: "", batesDigits: "6", batesStart: "1" };

const ZONES: { key: ZoneKey; label: string }[] = [
  { key: "topLeft", label: "Top left" },
  { key: "topCenter", label: "Top center" },
  { key: "topRight", label: "Top right" },
  { key: "bottomLeft", label: "Bottom left" },
  { key: "bottomCenter", label: "Bottom center" },
  { key: "bottomRight", label: "Bottom right" }
];

const TYPE_OPTIONS: { value: ZoneType; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "TEXT", label: "Custom text" },
  { value: "PAGE_NUMBER", label: "Page number" },
  { value: "DATE", label: "Today's date" },
  { value: "BATES", label: "Bates number" }
];

function initialZones(): Record<ZoneKey, ZoneState> {
  return {
    topLeft: { ...emptyZone },
    topCenter: { ...emptyZone },
    topRight: { ...emptyZone },
    bottomLeft: { ...emptyZone },
    bottomCenter: { ...emptyZone },
    bottomRight: { ...emptyZone }
  };
}

export default function HeaderFooterPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [zones, setZones] = useState<Record<ZoneKey, ZoneState>>(initialZones);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const selectFile = (picked: File) => {
    setError(null);
    setDone(false);
    setFile(picked);
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
    setDone(false);
  };

  const updateZone = (key: ZoneKey, patch: Partial<ZoneState>) => {
    setZones(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const submit = async () => {
    if (!file) return;
    const active = ZONES.filter(z => zones[z.key].type !== "NONE");
    if (active.length === 0) {
      setError("Configure at least one zone.");
      return;
    }
    for (const { key, label } of active) {
      const zone = zones[key];
      if (zone.type === "TEXT" && !zone.text.trim()) {
        setError(`${label} is set to custom text but has no text.`);
        return;
      }
    }

    setProcessing(true);
    setError(null);
    setDone(false);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    try {
      const toZonePayload = (zone: ZoneState) =>
        zone.type === "NONE"
          ? null
          : {
              type: zone.type,
              text: zone.type === "TEXT" ? zone.text.trim() : null,
              batesPrefix: zone.type === "BATES" ? zone.batesPrefix.trim() : null,
              batesDigits: zone.type === "BATES" ? Number(zone.batesDigits) || 6 : null,
              batesStart: zone.type === "BATES" ? Number(zone.batesStart) || 1 : null
            };

      const config = {
        topLeft: toZonePayload(zones.topLeft),
        topCenter: toZonePayload(zones.topCenter),
        topRight: toZonePayload(zones.topRight),
        bottomLeft: toZonePayload(zones.bottomLeft),
        bottomCenter: toZonePayload(zones.bottomCenter),
        bottomRight: toZonePayload(zones.bottomRight)
      };

      const formData = new FormData();
      formData.append("file", file, file.name);
      formData.append("config", JSON.stringify(config));

      const response = await fetch(`${API_BASE_URL}/api/v1/pdf/header-footer`, { method: "POST", body: formData });

      if (!response.ok) {
        let message = `Adding the header/footer failed (HTTP ${response.status}).`;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          try {
            const body = await response.json();
            message = body.error || body.message || message;
          } catch {}
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      if (!blob.size) throw new Error("The server returned an empty PDF.");

      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setDone(true);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "header-footer.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setFile(null);
    setZones(initialZones());
    setDone(false);
    setProcessing(false);
    setError(null);
    setDownloadUrl(null);
  };

  return (
    <main className="tool-page">
      <SiteHeader />

      <section className="tool-hero">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} /> All tools
        </Link>
        <div className="eyebrow">PDF TOOL</div>
        <h1>Header &amp; Footer</h1>
        <p>
          Build a compound header and footer — text, page numbers, dates, or Bates numbering in any
          of 6 positions.
        </p>
      </section>

      <section className="workspace">
        {error && (
          <div className="error-box">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {!done && (
          <SinglePdfInput file={file} onSelect={selectFile} onClear={clearFile} onError={setError} disabled={processing} />
        )}

        {file && !done && (
          <div className="file-panel" style={{ marginTop: 14 }}>
            <div className="panel-header">
              <div>
                <h2>Zones</h2>
                <p>Leave a zone set to &quot;None&quot; to skip it. Looking for just page numbers? Add Page Numbers is quicker.</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 22 }}>
              {ZONES.map(({ key, label }) => {
                const zone = zones[key];
                return (
                  <div className="option-card" key={key} style={{ cursor: "default" }}>
                    <strong>{label}</strong>
                    <select
                      className="text-input"
                      aria-label={`${label} content`}
                      value={zone.type}
                      onChange={e => updateZone(key, { type: e.target.value as ZoneType })}
                      disabled={processing}
                      style={{ marginTop: 8 }}
                    >
                      {TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    {zone.type === "TEXT" && (
                      <input
                        className="text-input"
                        type="text"
                        placeholder="Zone text"
                        aria-label={`${label} text`}
                        value={zone.text}
                        maxLength={200}
                        onChange={e => updateZone(key, { text: e.target.value })}
                        disabled={processing}
                        style={{ marginTop: 8 }}
                      />
                    )}

                    {zone.type === "BATES" && (
                      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                        <input
                          className="text-input"
                          type="text"
                          placeholder="Prefix, e.g. DOC-"
                          aria-label={`${label} Bates prefix`}
                          value={zone.batesPrefix}
                          maxLength={50}
                          onChange={e => updateZone(key, { batesPrefix: e.target.value })}
                          disabled={processing}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            className="text-input"
                            type="number"
                            min={1}
                            max={10}
                            placeholder="Digits"
                            value={zone.batesDigits}
                            onChange={e => updateZone(key, { batesDigits: e.target.value })}
                            disabled={processing}
                            aria-label={`${label} Bates digits`}
                          />
                          <input
                            className="text-input"
                            type="number"
                            min={0}
                            placeholder="Start at"
                            value={zone.batesStart}
                            onChange={e => updateZone(key, { batesStart: e.target.value })}
                            disabled={processing}
                            aria-label={`${label} Bates start number`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button type="button" className="primary-btn wide" disabled={processing} onClick={submit}>
              <LayoutTemplate size={16} /> {processing ? "Adding…" : "Add Header & Footer"}
            </button>
          </div>
        )}

        {done && (
          <div className="result-panel">
            <div className="success-icon">
              <CheckCircle2 size={38} />
            </div>
            <h2>Your PDF is ready</h2>
            <p>Your header/footer was added to every page. Your download should start automatically.</p>

            {downloadUrl && (
              <a className="primary-btn" href={downloadUrl} download="header-footer.pdf">
                <Download size={18} /> Download header-footer.pdf
              </a>
            )}

            <button type="button" className="secondary-btn" onClick={reset}>
              <XCircle size={17} /> Edit another PDF
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
