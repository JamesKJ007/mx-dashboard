"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <main style={{ padding: 32, maxWidth: 900, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>MyPlane MX ✈️</h1>

      <p style={{ maxWidth: 650, opacity: 0.85, marginTop: 0 }}>
        Aircraft maintenance + cost tracking, built for owners and partnerships.
      </p>

      <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a
          href="mailto:james.kjarrell@outlook.com?subject=MyPlane%20MX%20Access%20Request&body=Name:%0AEmail:%0AAircraft:%0ANote:%0A"
          style={{
            padding: "10px 14px",
            border: "1px solid #444",
            borderRadius: 10,
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Request Access ✅
        </a>

        <Link
          href="/login"
          style={{
            padding: "10px 14px",
            border: "1px solid #444",
            borderRadius: 10,
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Log In 🔐
        </Link>
      </div>

      <div
        style={{
          marginTop: 40,
          paddingTop: 12,
          borderTop: "1px solid #333",
          fontSize: 12,
          opacity: 0.7,
        }}
      >
        <Link href="/terms">Terms of Service</Link> ·{" "}
        <Link href="/privacy">Privacy Policy</Link>
      </div>
    </main>
  );
}