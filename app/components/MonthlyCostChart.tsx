"use client";

import { useMemo } from "react";
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

export default function MonthlyCostChart({ entries }: { entries: Entry[] }) {
  // ✅ IMPORTANT:
  // This component now assumes entries are ALREADY filtered by the page (monthlySpendEntries).
  // So no internal "View" state, no dropdown, no extra spacing fights.

  const totalsByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      const cat = e.category ?? "Other";
      map[cat] = (map[cat] ?? 0) + (e.amount ?? 0);
    }
    return map;
  }, [entries]);

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

  const entryCount = entries.length;
  const avgPerEntry = entryCount > 0 ? total / entryCount : 0;

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

  // ✅ Key fixes:
  // - maintainAspectRatio:false lets the chart fill the parent height instead of creating "air"
  // - we control height via a wrapper div
  // - reduce legend padding so it doesn’t push content down
  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          padding: 10,
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
      {total <= 0 ? (
        <div style={{ color: "#e5e7eb", opacity: 0.8 }}>
          No data for this view yet.
        </div>
      ) : (
        <>
          {/* ✅ This wrapper controls donut height and removes the weird bottom air */}
          <div style={{ height: 240, position: "relative" }}>
            <Doughnut data={data} options={options} />
          </div>

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
                Total
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