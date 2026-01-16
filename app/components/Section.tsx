"use client";

import React from "react";

type Props = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
};

export default function Section({ title, subtitle, right, children, style }: Props) {
  return (
    <section
      style={{
        padding: 14,
        borderRadius: 12,
        background: "#0f172a",
        border: "1px solid rgba(255,255,255,0.08)",
        marginBottom: 14,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#e5e7eb" }}>{title}</div>
          {subtitle ? (
            <div style={{ marginTop: 4, fontSize: 13, color: "#9ca3af" }}>{subtitle}</div>
          ) : null}
        </div>

        {right ? <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{right}</div> : null}
      </div>

      {children}
    </section>
  );
}