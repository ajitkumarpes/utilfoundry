import { ImageResponse } from "next/og";
import { TOOL_COUNT } from "@/lib/tools";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f7f5",
          fontFamily: "sans-serif"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 20,
              background: "#171717",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <svg width="58" height="58" viewBox="0 0 64 64">
              <path d="M18 17V33C18 42.5 23.6 48 32 48C40.4 48 46 42.5 46 33V17" fill="none" stroke="#F4B183" strokeWidth="5" strokeLinecap="round" />
              <path d="M16 51H48" fill="none" stroke="#F4B183" strokeWidth="5" strokeLinecap="round" />
              <path d="M50 11L52.5 16.5L58 19L52.5 21.5L50 27L47.5 21.5L42 19L47.5 16.5L50 11Z" fill="#F4B183" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 800, letterSpacing: -2, color: "#171717" }}>
            Util<span style={{ color: "#777" }}>Foundry</span>
          </div>
        </div>
        <div style={{ marginTop: 30, fontSize: 30, color: "#666", display: "flex" }}>
          {TOOL_COUNT} free PDF tools from UtilFoundry. Private by default. No account needed.
        </div>
      </div>
    ),
    { ...size }
  );
}
