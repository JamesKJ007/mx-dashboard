"use client";

import { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

type Entry = {
  category: string | null;
  amount: number | null;
  tach_hours: number | null;
  entry_date: string | null; // "YYYY-MM-DD"
};

type ViewMode = "all" | "year" | "month";

// ✅ Parse YYYY-MM-DD as LOCAL time for display (prevents Nov 30 / Dec 1 label bugs)
function parseLocalDate(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

// ✅ UTC-safe: use UTC for filtering "This Month/Year" so timezone can’t shift months
function toUTCDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function fmtDate(iso: string) {
  const d = parseLocalDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function inView(e: Entry, view: ViewMode) {
  if (view === "all") return true;
  if (!e.entry_date) return false;

  const dt = toUTCDate(e.entry_date);
  if (Number.isNaN(dt.getTime())) return false;

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  if (view === "year") return dt.getUTCFullYear() === year;
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month;
}

export default function CostPerHourTrendChart({ entries }: { entries: Entry[] }) {
  const [view, setView] = useState<ViewMode>("all");

  const points = useMemo(() => {
    // 1) Use ALL usable entries for baseline + cumulative math (ALL TIME)
    const allUsable = entries
      .filter(
        (e) =>
          typeof e.amount === "number" &&
          typeof e.tach_hours === "number" &&
          !!e.entry_date
      )
      .sort((a, b) => (a.tach_hours! - b.tach_hours!));

    if (allUsable.length < 2) return [];

    const baseTach = allUsable[0].tach_hours!;
    let cumulativeSpend = 0;

    // 2) Build computed series against ALL-TIME baseline
    const computed: { entry: Entry; label: string; cph: number }[] = [];

    for (const e of allUsable) {
      cumulativeSpend += e.amount ?? 0;

      const hours = e.tach_hours! - baseTach;
      if (hours <= 0) continue; // skip the very first baseline point

      const cph = cumulativeSpend / hours;

      computed.push({
        entry: e,
        label: `${fmtDate(e.entry_date!)} (${e.tach_hours!.toFixed(1)})`,
        cph,
      });
    }

    // 3) View filter ONLY decides which points to show — it does NOT reset baseline
    return computed
      .filter((p) => inView(p.entry, view))
      .map((p) => ({ label: p.label, cph: p.cph }));
  }, [entries, view]);

  const labels = points.map((p) => p.label);
  const values = points.map((p) => Number(p.cph.toFixed(2)));

  // ✅ Blue theme (this is what you lost)
  const BLUE_LINE = "rgba(96,165,250,1)"; // #60a5fa
  const BLUE_FILL = "rgba(96,165,250,0.15)";

  const data = {
    labels,
    datasets: [
      {
        label: "Cost / Hour ($)",
        data: values,

        // ✅ restore the blue colors
        borderColor: BLUE_LINE,
        backgroundColor: BLUE_FILL,

        tension: 0.25,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 6,

        // ✅ keep points blue too
        pointBackgroundColor: BLUE_LINE,
        pointBorderColor: BLUE_LINE,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: "#e5e7eb",
          font: { size: 12, weight: 500 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = Number(ctx.raw ?? 0);
            return ` $${v.toFixed(2)} / hr`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "#e5e7eb" },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
      y: {
        ticks: {
          color: "#e5e7eb",
          callback: (value) => `$${value}`,
        },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
    },
  };

  const hasChart = points.length >= 2;

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ color: "#e5e7eb", fontWeight: 700 }}>Cost / Hour Trend</div>

        <label
          style={{
            color: "#e5e7eb",
            fontSize: 13,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          View
          <select
            value={view}
            onChange={(e) => setView(e.target.value as ViewMode)}
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "#e5e7eb",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              padding: "6px 10px",
              outline: "none",
            }}
          >
            <option value="all">All Time</option>
            <option value="year">This Year</option>
            <option value="month">This Month</option>
          </select>
        </label>
      </div>

      {!hasChart ? (
        <div style={{ opacity: 0.8, fontSize: 13, color: "#e5e7eb" }}>
          Add at least 2 entries (within this view) with <b>Amount</b> +{" "}
          <b>Tach Hours</b> + <b>Date</b> to see the trend.
        </div>
      ) : (
        <Line data={data} options={options} />
      )}
    </div>
  );
}