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
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 46,
              fontWeight: 800
            }}
          >
            P
          </div>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 800, letterSpacing: -2, color: "#171717" }}>
            PDF<span style={{ color: "#777" }}>Lab</span>
          </div>
        </div>
        <div style={{ marginTop: 30, fontSize: 30, color: "#666", display: "flex" }}>
          {TOOL_COUNT} free PDF tools. Private by default. No account needed.
        </div>
      </div>
    ),
    { ...size }
  );
}
