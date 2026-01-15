"use client";

import { useMemo } from "react";

type MonthlyRow = {
  aircraft_id: string;
  month: string; // YYYY-MM-DD (first day of month)
  total_hours: number;
  total_income: number;
};

function money(n: number | null | undefined) {
  const v = n ?? 0;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function monthLabel(iso: string) {
  // iso like "2026-01-01"
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleString("en-US", { month: "short" });
}

export default function MonthlyRentalRevenueChart({
  monthly,
  monthsToShow = 6,
}: {
  monthly: MonthlyRow[];
  monthsToShow?: number;
}) {
  const rows = useMemo(() => {
    const sorted = [...(monthly ?? [])].sort((a, b) => a.month.localeCompare(b.month));
    return sorted.slice(-monthsToShow);
  }, [monthly, monthsToShow]);

  const max = useMemo(() => {
    return rows.reduce((m, r) => Math.max(m, r.total_income ?? 0), 0) || 1;
  }, [rows]);

  if (!rows.length) {
    return (
      <div style={{ marginTop: 14, color: "#6b7280", fontSize: 13 }}>
        No monthly revenue yet — log rental hours to populate this chart.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontWeight: 700 }}>Monthly Rental Revenue</div>
        <div style={{ color: "#6b7280", fontSize: 13 }}>Last {rows.length} months</div>
      </div>

      <div
        style={{
          marginTop: 10,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 120 }}>
          {rows.map((r) => {
            const h = Math.max(6, Math.round(((r.total_income ?? 0) / max) * 100));
            return (
              <div key={r.month} style={{ flex: 1, textAlign: "center" }}>
                <div
                  title={`${r.month} • ${money(r.total_income)} • ${r.total_hours ?? 0} hrs`}
                  style={{
                    height: `${h}%`,
                    minHeight: 6,
                    borderRadius: 10,
                    border: "1px solid #111827",
                    background: "#111827",
                    width: "100%",
                  }}
                />
                <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                  {monthLabel(r.month)}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <div style={{ color: "#6b7280" }}>Max</div>
          <div style={{ fontWeight: 700 }}>{money(max)}</div>
        </div>
      </div>
    </div>
  );
}
