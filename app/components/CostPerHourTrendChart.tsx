"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
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
  entry_date: string | null;
};

function fmtDate(iso: string) {
  // iso = "YYYY-MM-DD"
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function CostPerHourTrendChart({ entries }: { entries: Entry[] }) {
  const points = useMemo(() => {
    // Keep only entries that can affect $/hr
    const usable = entries
      .filter(
        (e) =>
          typeof e.amount === "number" &&
          typeof e.tach_hours === "number" &&
          !!e.entry_date
      )
      // Sort by tach so "hours flown" is consistent
      .sort((a, b) => (a.tach_hours! - b.tach_hours!));

    if (usable.length < 2) return [];

    const baseTach = usable[0].tach_hours!;
    let cumulativeSpend = 0;

    const out: { label: string; cph: number }[] = [];

    for (const e of usable) {
      cumulativeSpend += e.amount ?? 0;

      const hours = e.tach_hours! - baseTach;
      if (hours <= 0) continue;

      const cph = cumulativeSpend / hours;
      out.push({
        label: fmtDate(e.entry_date!),
        cph,
      });
    }

    // Reduce noise if you have many entries on same day:
    // Keep last point per label
    const dedup = new Map<string, number>();
    for (const p of out) dedup.set(p.label, p.cph);

    return Array.from(dedup.entries()).map(([label, cph]) => ({ label, cph }));
  }, [entries]);

  const labels = points.map((p) => p.label);
  const values = points.map((p) => Number(p.cph.toFixed(2)));

  const data = {
    labels,
    datasets: [
      {
        label: "Cost / Hour ($)",
        data: values,
        borderColor: "#60a5fa", // blue-ish line
        backgroundColor: "rgba(96,165,250,0.15)",
        tension: 0.25,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: "#e5e7eb",
          font: { size: 12, weight: 500 as const },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
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
          callback: (value: any) => `$${value}`,
        },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
    },
  };

  if (points.length < 2) {
    return (
      <div style={{ opacity: 0.8, fontSize: 13 }}>
        Add at least 2 entries with <b>Amount</b> + <b>Tach Hours</b> + <b>Date</b> to see the Cost/Hour trend.
      </div>
    );
  }

  return <Line data={data} options={options as any} />;
}