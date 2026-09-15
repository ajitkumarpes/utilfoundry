import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#171717",
          borderRadius: 8,
          fontFamily: "sans-serif"
        }}
      >
        <svg width="23" height="23" viewBox="0 0 64 64">
          <path d="M18 17V33C18 42.5 23.6 48 32 48C40.4 48 46 42.5 46 33V17" fill="none" stroke="#F4B183" strokeWidth="5" strokeLinecap="round" />
          <path d="M16 51H48" fill="none" stroke="#F4B183" strokeWidth="5" strokeLinecap="round" />
          <path d="M50 11L52.5 16.5L58 19L52.5 21.5L50 27L47.5 21.5L42 19L47.5 16.5L50 11Z" fill="#F4B183" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
