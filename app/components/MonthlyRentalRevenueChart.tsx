"use client";

import { useMemo } from "react";

export type MonthlyRow = {
  aircraft_id: string;
  month: string; // YYYY-MM-01
  total_hours: number;
  total_income: number;

  // NEW (for profit math)
  total_spend?: number; // maintenance spend for that month (optional)
  profit?: number; // income - spend (optional)
  profit_per_hour?: number; // profit / hours (optional)
};

function money(n: number | null | undefined) {
  const v = n ?? 0;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function monthLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleString("en-US", { month: "short" });
}

export default function MonthlyRentalRevenueChart({
  rows,
  labelRight,
}: {
  rows: MonthlyRow[];
  labelRight?: string;
}) {
  const safeRows = useMemo(() => rows ?? [], [rows]);

  const max = useMemo(() => {
    // scale by revenue so the line is stable
    const m = safeRows.reduce((acc, r) => Math.max(acc, r.total_income ?? 0), 0);
    return m > 0 ? m : 1;
  }, [safeRows]);

  if (!safeRows.length) {
    return (
      <div style={{ marginTop: 14, color: "#9ca3af", fontSize: 13 }}>
        No monthly revenue yet — log rental hours to populate this chart.
      </div>
    );
  }

  // SVG chart geometry
  const width = 640;
  const height = 160;
  const padX = 20;
  const padY = 18;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = safeRows.map((r, i) => {
    const x = padX + (safeRows.length === 1 ? innerW / 2 : (i / (safeRows.length - 1)) * innerW);
    const y = padY + (1 - (r.total_income ?? 0) / max) * innerH;
    return { x, y, r };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  const areaPath =
    `${linePath} ` +
    `L ${points[points.length - 1].x.toFixed(2)} ${(padY + innerH).toFixed(2)} ` +
    `L ${points[0].x.toFixed(2)} ${(padY + innerH).toFixed(2)} Z`;

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontWeight: 700 }}>Monthly Rental Revenue</div>
        <div style={{ color: "#9ca3af", fontSize: 13 }}>
          {labelRight ?? `Last ${safeRows.length} months`}
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 12,
          padding: 12,
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: "block" }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* baseline */}
          <line
            x1={padX}
            y1={padY + innerH}
            x2={padX + innerW}
            y2={padY + innerH}
            stroke="rgba(255,255,255,0.15)"
          />

          {/* area fill */}
          <path d={areaPath} fill="url(#revFill)" />

          {/* line */}
          <path
            d={linePath}
            fill="none"
            stroke="#60a5fa"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* points + tooltip */}
          {points.map((p) => {
            const profitHr =
              typeof p.r.profit_per_hour === "number"
                ? p.r.profit_per_hour
                : typeof p.r.profit === "number" && (p.r.total_hours ?? 0) > 0
                  ? p.r.profit / (p.r.total_hours ?? 1)
                  : null;

            return (
              <g key={p.r.month}>
                <circle cx={p.x} cy={p.y} r={4.5} fill="#60a5fa" />
                <circle cx={p.x} cy={p.y} r={7.5} fill="#60a5fa" opacity={0.18} />
                <title>
                  {monthLabel(p.r.month)} • Revenue {money(p.r.total_income)} • Hours {(p.r.total_hours ?? 0).toFixed(1)}
                  {typeof p.r.total_spend === "number" ? ` • Spend ${money(p.r.total_spend)}` : ""}
                  {typeof p.r.profit === "number" ? ` • Profit ${money(p.r.profit)}` : ""}
                  {profitHr !== null ? ` • Profit/Hr ${money(profitHr)}` : ""}
                </title>
              </g>
            );
          })}
        </svg>

        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <div style={{ color: "#9ca3af" }}>Max</div>
          <div style={{ fontWeight: 700 }}>{money(max)}</div>
        </div>

        <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", color: "#9ca3af", fontSize: 12 }}>
          <div>{monthLabel(safeRows[0].month)}</div>
          <div>{monthLabel(safeRows[safeRows.length - 1].month)}</div>
        </div>
      </div>
    </div>
  );
}