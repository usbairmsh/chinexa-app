"use client";

import { useEffect } from "react";

// Last-resort boundary for errors thrown in the ROOT layout itself, which the
// per-segment error.tsx can't catch. It must render its own <html>/<body>
// because at this point the root layout has failed. Kept dependency-free and
// inline-styled so it works even if the app's CSS/providers are what broke.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#FFF8FB",
          color: "#3A2438",
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>Something went wrong</h1>
        <p style={{ color: "#6E5A75", maxWidth: "28rem", marginBottom: "1.5rem" }}>
          A temporary error stopped the page from loading. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            background: "#7A4FA0",
            color: "#fff",
            border: "none",
            borderRadius: "999px",
            padding: "0.75rem 1.5rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
