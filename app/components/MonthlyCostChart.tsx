"use client";

import { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

type Entry = {
  category: string | null;
  amount: number | null;
  entry_date: string | null; // "YYYY-MM-DD"
};

type ViewMode = "all" | "year" | "month";

// ✅ Parse YYYY-MM-DD as LOCAL time (prevents date shifting / missing entries)
function parseLocalDate(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

export default function MonthlyCostChart({ entries }: { entries: Entry[] }) {
  const [view, setView] = useState<ViewMode>("all");

  const filtered = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11

    return entries.filter((e) => {
      if (!e.entry_date) return false;

      const d = parseLocalDate(e.entry_date);
      if (Number.isNaN(d.getTime())) return false;

      if (view === "month") {
        return d.getFullYear() === year && d.getMonth() === month;
      }
      if (view === "year") {
        return d.getFullYear() === year;
      }
      return true;
    });
  }, [entries, view]);

  const totalsByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of filtered) {
      const cat = e.category ?? "Other";
      map[cat] = (map[cat] ?? 0) + (e.amount ?? 0);
    }
    return map;
  }, [filtered]);

  const labels = Object.keys(totalsByCategory);
  const values = Object.values(totalsByCategory);
  const total = values.reduce((a, b) => a + b, 0);

  const topIndex = useMemo(() => {
    if (!values.length) return -1;
    let idx = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[idx]) idx = i;
    }
    return idx;
  }, [values]);

  const topLabel = topIndex >= 0 ? labels[topIndex] : "—";
  const topValue = topIndex >= 0 ? values[topIndex] : 0;
  const topPercent = total > 0 ? (topValue / total) * 100 : 0;

  const entryCount = filtered.length;
  const avgPerEntry = entryCount > 0 ? total / entryCount : 0;

  const viewLabel =
    view === "month" ? "This Month" : view === "year" ? "This Year" : "All Time";

  const colors = [
    "#22c55e", // green
    "#ef4444", // red
    "#facc15", // yellow
    "#3b82f6", // blue
    "#a855f7", // purple
    "#fb923c", // orange
  ];

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: labels.map((_, i) => colors[i % colors.length]),
        borderWidth: 0,
        hoverOffset: 8,
        cutout: "65%",
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          padding: 16,
          font: {
            size: 12,
            weight: 500,
          },
          generateLabels: (chart) => {
            const d = chart.data;
            if (!d.labels?.length || !d.datasets?.length) return [];

            const dataset = d.datasets[0];
            const dsData = (dataset.data ?? []) as number[];
            const dsColors = (dataset.backgroundColor ?? []) as string[];

            const sum = dsData.reduce((s, v) => s + (Number(v) || 0), 0);

            return (d.labels as string[]).map((label, i) => {
              const value = Number(dsData[i] ?? 0);
              const percent = sum ? ((value / sum) * 100).toFixed(1) : "0.0";

              return {
                text: `${label} — ${percent}%`,
                fillStyle: dsColors[i] ?? "#94a3b8",
                strokeStyle: dsColors[i] ?? "#94a3b8",
                lineWidth: 0,
                hidden: !chart.getDataVisibility(i),
                index: i,
                // ✅ keeps legend text readable
                fontColor: "#e5e7eb",
              };
            });
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = Number(context.raw ?? 0);
            const ds = context.dataset.data as number[];
            const sum = ds.reduce((s, v) => s + (Number(v) || 0), 0);
            const percent = sum ? ((value / sum) * 100).toFixed(1) : "0.0";
            return `$${value.toFixed(2)} (${percent}%)`;
          },
        },
      },
    },
  };

  return (
    <div>
      {/* View selector */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ marginRight: 8, opacity: 0.8, color: "#e5e7eb" }}>
          View
        </label>
        <select
          value={view}
          onChange={(e) => setView(e.target.value as ViewMode)}
          style={{
            background: "#020617",
            color: "white",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            padding: "4px 10px",
          }}
        >
          <option value="all">All Time</option>
          <option value="year">This Year</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {total <= 0 ? (
        <div style={{ color: "#e5e7eb", opacity: 0.8 }}>
          No data for this view yet.
        </div>
      ) : (
        <>
          <Doughnut data={data} options={options} />

          {/* Summary Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
              marginTop: 12,
            }}
          >
            {/* Total */}
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.75, color: "#e5e7eb" }}>
                Total ({viewLabel})
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "white",
                  marginTop: 4,
                }}
              >
                ${total.toFixed(2)}
              </div>
            </div>

            {/* Top Category */}
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.75, color: "#e5e7eb" }}>
                Top Category
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "white",
                  marginTop: 4,
                }}
              >
                {topLabel}
              </div>
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.85,
                  color: "#e5e7eb",
                  marginTop: 2,
                }}
              >
                {topPercent.toFixed(1)}% • ${topValue.toFixed(2)}
              </div>
            </div>

            {/* Entries */}
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.75, color: "#e5e7eb" }}>
                Entries
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "white",
                  marginTop: 4,
                }}
              >
                {entryCount}
              </div>
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.85,
                  color: "#e5e7eb",
                  marginTop: 2,
                }}
              >
                Avg: ${avgPerEntry.toFixed(2)} / entry
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}