"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type RentalLog = {
  id: string;
  aircraft_id: string;
  rental_date: string; // YYYY-MM-DD
  hours: number;
  hourly_rate: number;
  note: string | null;
  created_by: string | null;
};

type RentalRate = {
  id: string;
  aircraft_id: string;
  hourly_rate: number;
  effective_from: string; // YYYY-MM-DD
};

type MaintenanceEntry = {
  id: string;
  aircraft_id: string;
  entry_date: string; // YYYY-MM-DD
  amount: number;
};

type ViewMode = "month" | "year" | "all";

function money(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function monthName(mIndex0: number) {
  return new Date(2000, mIndex0, 1).toLocaleString("en-US", { month: "long" });
}
function monthShort(mIndex0: number) {
  return new Date(2000, mIndex0, 1).toLocaleString("en-US", { month: "short" });
}

function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function firstOfMonth(year: number, month0: number) {
  return new Date(year, month0, 1);
}
function lastOfMonth(year: number, month0: number) {
  return new Date(year, month0 + 1, 0);
}

export default function RentalIncomePanel({ aircraftId }: { aircraftId: string }) {
  const now = new Date();
  const [view, setView] = useState<ViewMode>("year");
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth0, setSelectedMonth0] = useState<number>(now.getMonth());

  const [logs, setLogs] = useState<RentalLog[]>([]);
  const [rates, setRates] = useState<RentalRate[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Modals
  const [showRateModal, setShowRateModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  // Form state
  const [rateValue, setRateValue] = useState<string>("");
  const [rateEffective, setRateEffective] = useState<string>(ymd(new Date()));

  const [logDate, setLogDate] = useState<string>(ymd(new Date()));
  const [logHours, setLogHours] = useState<string>("");
  const [logNote, setLogNote] = useState<string>("");

  // ✅ Collapsible panel state
  const [collapsed, setCollapsed] = useState(false);

  // Load data
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const { data: logsData, error: logsErr } = await supabase
          .from("aircraft_rental_logs")
          .select("id, aircraft_id, rental_date, hours, hourly_rate, note, created_by")
          .eq("aircraft_id", aircraftId)
          .order("rental_date", { ascending: true });

        if (logsErr) throw logsErr;

        const { data: ratesData, error: ratesErr } = await supabase
          .from("aircraft_rental_rates")
          .select("id, aircraft_id, hourly_rate, effective_from")
          .eq("aircraft_id", aircraftId)
          .order("effective_from", { ascending: true });

        if (ratesErr) throw ratesErr;

        const { data: maintData, error: maintErr } = await supabase
          .from("maintenance_entries")
          .select("id, aircraft_id, entry_date, amount")
          .eq("aircraft_id", aircraftId)
          .order("entry_date", { ascending: true });

        if (maintErr) throw maintErr;

        if (!alive) return;

        setLogs((logsData ?? []) as RentalLog[]);
        setRates((ratesData ?? []) as RentalRate[]);
        setMaintenance((maintData ?? []) as MaintenanceEntry[]);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Failed to load rental income data.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [aircraftId]);

  // Current hourly rate
  const currentRate = useMemo(() => {
    if (!rates.length) return null;

    const today = ymd(new Date());
    const usable = rates
      .filter((r) => r.effective_from <= today)
      .sort((a, b) => a.effective_from.localeCompare(b.effective_from));

    return usable.length ? usable[usable.length - 1] : rates[rates.length - 1];
  }, [rates]);

  // Range filtering
  const range = useMemo(() => {
    if (view === "all") {
      return { start: "0000-01-01", end: "9999-12-31", label: "All Time" };
    }
    if (view === "year") {
      const start = `${selectedYear}-01-01`;
      const end = `${selectedYear}-12-31`;
      return { start, end, label: `Year ${selectedYear}` };
    }
    const startDate = firstOfMonth(selectedYear, selectedMonth0);
    const endDate = lastOfMonth(selectedYear, selectedMonth0);
    return {
      start: ymd(startDate),
      end: ymd(endDate),
      label: `${monthName(selectedMonth0)} ${selectedYear}`,
    };
  }, [view, selectedYear, selectedMonth0]);

  const logsInRange = useMemo(() => {
    return logs.filter((l) => l.rental_date >= range.start && l.rental_date <= range.end);
  }, [logs, range]);

  const maintenanceInRange = useMemo(() => {
    return maintenance.filter((m) => m.entry_date >= range.start && m.entry_date <= range.end);
  }, [maintenance, range]);

  const totals = useMemo(() => {
    const hours = logsInRange.reduce((s, l) => s + (Number(l.hours) || 0), 0);
    const revenue = logsInRange.reduce(
      (s, l) => s + (Number(l.hours) || 0) * (Number(l.hourly_rate) || 0),
      0
    );
    const spend = maintenanceInRange.reduce((s, m) => s + (Number(m.amount) || 0), 0);
    const profit = revenue - spend;
    const profitPerHr = hours > 0 ? profit / hours : null;
    return { hours, revenue, spend, profit, profitPerHr };
  }, [logsInRange, maintenanceInRange]);

  const yearSeries = useMemo(() => {
    const year = view === "all" ? now.getFullYear() : selectedYear;

    const out = Array.from({ length: 12 }).map((_, month0) => {
      const start = ymd(firstOfMonth(year, month0));
      const end = ymd(lastOfMonth(year, month0));

      const monthLogs = logs.filter((l) => l.rental_date >= start && l.rental_date <= end);
      const monthMaint = maintenance.filter((m) => m.entry_date >= start && m.entry_date <= end);

      const hours = monthLogs.reduce((s, l) => s + (Number(l.hours) || 0), 0);
      const revenue = monthLogs.reduce(
        (s, l) => s + (Number(l.hours) || 0) * (Number(l.hourly_rate) || 0),
        0
      );
      const spend = monthMaint.reduce((s, m) => s + (Number(m.amount) || 0), 0);
      const profit = revenue - spend;
      const profitPerHr = hours > 0 ? profit / hours : null;

      return { month0, start, end, hours, revenue, spend, profit, profitPerHr };
    });

    return { year, rows: out };
  }, [logs, maintenance, selectedYear, view, now]);

  const chart = useMemo(() => {
    const rows = yearSeries.rows;
    const maxRevenue = rows.reduce((m, r) => Math.max(m, r.revenue), 0) || 1;

    const width = 640;
    const height = 170;
    const padX = 22;
    const padY = 18;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;

    const points = rows.map((r, i) => {
      const x = padX + (i / 11) * innerW;
      const y = padY + (1 - r.revenue / maxRevenue) * innerH;
      return { x, y, r };
    });

    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");

    const areaPath =
      `${linePath} ` +
      `L ${points[points.length - 1].x.toFixed(2)} ${(padY + innerH).toFixed(2)} ` +
      `L ${points[0].x.toFixed(2)} ${(padY + innerH).toFixed(2)} Z`;

    return { width, height, padX, padY, innerW, innerH, points, linePath, areaPath, maxRevenue };
  }, [yearSeries]);

  async function saveRate() {
    setErr(null);
    const rateNum = Number(rateValue);
    if (!rateNum || rateNum <= 0) {
      setErr("Hourly rate must be a positive number.");
      return;
    }
    if (!rateEffective) {
      setErr("Effective From date is required.");
      return;
    }

    const { error } = await supabase.from("aircraft_rental_rates").insert({
      aircraft_id: aircraftId,
      hourly_rate: rateNum,
      effective_from: rateEffective,
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setShowRateModal(false);
    setRateValue("");

    const { data, error: e } = await supabase
      .from("aircraft_rental_rates")
      .select("id, aircraft_id, hourly_rate, effective_from")
      .eq("aircraft_id", aircraftId)
      .order("effective_from", { ascending: true });

    if (!e) setRates((data ?? []) as RentalRate[]);
  }

  async function saveLog() {
    setErr(null);

    const hrs = Number(logHours);
    if (!logDate) {
      setErr("Rental date is required.");
      return;
    }
    if (!hrs || hrs <= 0) {
      setErr("Hours must be a positive number.");
      return;
    }

    const rate = currentRate?.hourly_rate ?? Number(rateValue) ?? 0;
    if (!rate || rate <= 0) {
      setErr("Set an hourly rate first.");
      return;
    }

    const { error } = await supabase.from("aircraft_rental_logs").insert({
      aircraft_id: aircraftId,
      rental_date: logDate,
      hours: hrs,
      hourly_rate: rate,
      note: logNote || null,
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setShowLogModal(false);
    setLogHours("");
    setLogNote("");

    const { data, error: e } = await supabase
      .from("aircraft_rental_logs")
      .select("id, aircraft_id, rental_date, hours, hourly_rate, note, created_by")
      .eq("aircraft_id", aircraftId)
      .order("rental_date", { ascending: true });

    if (!e) setLogs((data ?? []) as RentalLog[]);
  }

  const years = useMemo(() => {
    const y0 = now.getFullYear();
    return Array.from({ length: 8 }).map((_, i) => y0 - 5 + i);
  }, [now]);

  const monthOptions = useMemo(() => Array.from({ length: 12 }).map((_, i) => i), []);

  const cardStyle: React.CSSProperties = {
    padding: 12,
    borderRadius: 12,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(2,6,23,0.85)",
    color: "#e5e7eb",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 10,
    padding: "10px 12px",
    outline: "none",
  };

  const buttonStyle: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "#e5e7eb",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 700,
    cursor: "pointer",
  };

  if (loading) {
    return <div style={{ color: "#e5e7eb", opacity: 0.85 }}>Loading rental income…</div>;
  }

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 16, padding: 14 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        {/* ✅ Clickable title area toggles collapse */}
        <div
          onClick={() => setCollapsed((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <span
            style={{
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
              color: "#e5e7eb",
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ▼
          </span>

          <div>
            <div style={{ color: "#e5e7eb", fontWeight: 800, fontSize: 16 }}>Rental Income</div>
            <div style={{ color: "#9ca3af", fontSize: 13 }}>Track hours-based rental income for this aircraft.</div>
          </div>
        </div>

        {/* ✅ When collapsed, hide controls */}
        {!collapsed && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ color: "#9ca3af", fontSize: 13 }}>View</div>

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
                fontWeight: 700,
              }}
            >
              <option value="month">Month</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
            </select>

            {view === "month" && (
              <>
                <select
                  value={String(selectedMonth0)}
                  onChange={(e) => setSelectedMonth0(Number(e.target.value))}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: "#e5e7eb",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 10,
                    padding: "6px 10px",
                    outline: "none",
                    fontWeight: 700,
                  }}
                >
                  {monthOptions.map((m0) => (
                    <option key={m0} value={String(m0)}>
                      {monthName(m0)}
                    </option>
                  ))}
                </select>

                <select
                  value={String(selectedYear)}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: "#e5e7eb",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 10,
                    padding: "6px 10px",
                    outline: "none",
                    fontWeight: 700,
                  }}
                >
                  {years.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </>
            )}

            {view === "year" && (
              <select
                value={String(selectedYear)}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "#e5e7eb",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  padding: "6px 10px",
                  outline: "none",
                  fontWeight: 700,
                }}
              >
                {years.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            )}

            <button style={buttonStyle} onClick={() => setShowRateModal(true)}>
              Set Rate
            </button>
            <button style={buttonStyle} onClick={() => setShowLogModal(true)}>
              Log Rental Hours
            </button>
          </div>
        )}
      </div>

      {/* ✅ If collapsed, stop rendering the body */}
      {collapsed ? null : (
        <>
          {/* Error */}
          {err && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 12,
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.35)",
                color: "#fecaca",
                fontWeight: 700,
              }}
            >
              {err}
            </div>
          )}

          {/* Top cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 12 }}>
            <div style={cardStyle}>
              <div style={{ color: "#9ca3af", fontSize: 12 }}>Current Hourly Rate</div>
              <div style={{ color: "#e5e7eb", fontSize: 20, fontWeight: 900, marginTop: 4 }}>
                {currentRate ? money(currentRate.hourly_rate) : "Not set"}
              </div>
              <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>
                {currentRate ? `Effective ${currentRate.effective_from}` : "Set a rate to start logging"}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ color: "#9ca3af", fontSize: 12 }}>Revenue ({range.label})</div>
              <div style={{ color: "#e5e7eb", fontSize: 20, fontWeight: 900, marginTop: 4 }}>{money(totals.revenue)}</div>
              <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>{totals.hours.toFixed(1)} hours</div>
            </div>

            <div style={cardStyle}>
              <div style={{ color: "#9ca3af", fontSize: 12 }}>Profit (Revenue - Spend)</div>
              <div style={{ color: "#e5e7eb", fontSize: 20, fontWeight: 900, marginTop: 4 }}>{money(totals.profit)}</div>
              <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>
                Profit / Hr {totals.profitPerHr == null ? "—" : money(totals.profitPerHr)}
              </div>
            </div>
          </div>

          {/* Small stat row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10, marginTop: 10 }}>
            <div style={cardStyle}>
              <div style={{ color: "#9ca3af", fontSize: 12 }}>Revenue</div>
              <div style={{ color: "#e5e7eb", fontWeight: 900, marginTop: 4 }}>{money(totals.revenue)}</div>
            </div>
            <div style={cardStyle}>
              <div style={{ color: "#9ca3af", fontSize: 12 }}>Hours</div>
              <div style={{ color: "#e5e7eb", fontWeight: 900, marginTop: 4 }}>{totals.hours.toFixed(1)}</div>
            </div>
            <div style={cardStyle}>
              <div style={{ color: "#9ca3af", fontSize: 12 }}>Spend</div>
              <div style={{ color: "#e5e7eb", fontWeight: 900, marginTop: 4 }}>{money(totals.spend)}</div>
            </div>
            <div style={cardStyle}>
              <div style={{ color: "#9ca3af", fontSize: 12 }}>Profit</div>
              <div style={{ color: "#e5e7eb", fontWeight: 900, marginTop: 4 }}>{money(totals.profit)}</div>
            </div>
            <div style={cardStyle}>
              <div style={{ color: "#9ca3af", fontSize: 12 }}>Profit / Hr</div>
              <div style={{ color: "#e5e7eb", fontWeight: 900, marginTop: 4 }}>
                {totals.profitPerHr == null ? "—" : money(totals.profitPerHr)}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontWeight: 900, color: "#e5e7eb" }}>Monthly Rental Revenue</div>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                {view === "all" ? `Year ${now.getFullYear()}` : `Year ${yearSeries.year}`}
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
              <svg viewBox={`0 0 ${chart.width} ${chart.height}`} width="100%" height={chart.height} style={{ display: "block" }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                <line
                  x1={chart.padX}
                  y1={chart.padY + chart.innerH}
                  x2={chart.padX + chart.innerW}
                  y2={chart.padY + chart.innerH}
                  stroke="rgba(255,255,255,0.15)"
                />

                <path d={chart.areaPath} fill="url(#revFill)" />
                <path
                  d={chart.linePath}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {chart.points.map((p) => {
                  const r = p.r;
                  const pph = r.profitPerHr == null ? "—" : money(r.profitPerHr);
                  return (
                    <g key={r.start}>
                      <circle cx={p.x} cy={p.y} r={4.5} fill="#3b82f6" />
                      <circle cx={p.x} cy={p.y} r={7.5} fill="#3b82f6" opacity={0.15} />
                      <title>
                        {monthName(r.month0)} {yearSeries.year}
                        {" • "}Revenue {money(r.revenue)}
                        {" • "}Spend {money(r.spend)}
                        {" • "}Profit {money(r.profit)}
                        {" • "}Profit/hr {pph}
                        {" • "}{r.hours.toFixed(1)} hrs
                      </title>
                    </g>
                  );
                })}
              </svg>

              <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <div style={{ color: "#9ca3af" }}>Max</div>
                <div style={{ fontWeight: 900, color: "#e5e7eb" }}>{money(chart.maxRevenue)}</div>
              </div>

              <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", color: "#9ca3af", fontSize: 12 }}>
                <div>{monthShort(0)}</div>
                <div>{monthShort(11)}</div>
              </div>
            </div>
          </div>

          {/* Logs table */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, color: "#e5e7eb" }}>
              Rental Logs <span style={{ color: "#9ca3af", fontWeight: 700 }}>({logsInRange.length} entries)</span>
            </div>

            {!logsInRange.length ? (
              <div style={{ marginTop: 8, color: "#9ca3af" }}>No rental logs in this view yet.</div>
            ) : (
              <div style={{ marginTop: 8, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.06)" }}>
                      <th style={{ textAlign: "left", padding: 10, color: "#e5e7eb" }}>Date</th>
                      <th style={{ textAlign: "left", padding: 10, color: "#e5e7eb" }}>Hours</th>
                      <th style={{ textAlign: "left", padding: 10, color: "#e5e7eb" }}>Rate</th>
                      <th style={{ textAlign: "left", padding: 10, color: "#e5e7eb" }}>Income</th>
                      <th style={{ textAlign: "left", padding: 10, color: "#e5e7eb" }}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsInRange
                      .slice()
                      .sort((a, b) => b.rental_date.localeCompare(a.rental_date))
                      .map((l) => {
                        const income = (Number(l.hours) || 0) * (Number(l.hourly_rate) || 0);
                        return (
                          <tr key={l.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                            <td style={{ padding: 10, color: "#e5e7eb" }}>{l.rental_date}</td>
                            <td style={{ padding: 10, color: "#e5e7eb" }}>{Number(l.hours).toFixed(1)}</td>
                            <td style={{ padding: 10, color: "#e5e7eb" }}>{money(l.hourly_rate)}</td>
                            <td style={{ padding: 10, color: "#e5e7eb" }}>{money(income)}</td>
                            <td style={{ padding: 10, color: "#9ca3af" }}>{l.note ?? "—"}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RATE MODAL */}
          {showRateModal && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
                padding: 16,
              }}
            >
              <div
                style={{
                  width: "min(560px, 100%)",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "#0b1220",
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ color: "#e5e7eb", fontWeight: 900, fontSize: 16 }}>Set Hourly Rate</div>
                  <button style={buttonStyle} onClick={() => setShowRateModal(false)}>
                    Close
                  </button>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 6 }}>Hourly Rate (USD)</div>
                  <input
                    value={rateValue}
                    onChange={(e) => setRateValue(e.target.value)}
                    placeholder="e.g. 180"
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 6 }}>Effective From</div>
                  <input
                    type="date"
                    value={rateEffective}
                    onChange={(e) => setRateEffective(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 10 }}>
                  Tip: changing rates later won’t rewrite previous log snapshots.
                </div>

                <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button style={buttonStyle} onClick={() => setShowRateModal(false)}>
                    Cancel
                  </button>
                  <button
                    style={{
                      ...buttonStyle,
                      background: "#111827",
                      borderColor: "rgba(255,255,255,0.18)",
                    }}
                    onClick={saveRate}
                  >
                    Save Rate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* LOG MODAL */}
          {showLogModal && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
                padding: 16,
              }}
            >
              <div
                style={{
                  width: "min(560px, 100%)",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "#0b1220",
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ color: "#e5e7eb", fontWeight: 900, fontSize: 16 }}>Log Rental Hours</div>
                  <button style={buttonStyle} onClick={() => setShowLogModal(false)}>
                    Close
                  </button>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 6 }}>Rental Date</div>
                  <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} style={inputStyle} />
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 6 }}>Hours</div>
                  <input
                    value={logHours}
                    onChange={(e) => setLogHours(e.target.value)}
                    placeholder="e.g. 2.5"
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 6 }}>Note (optional)</div>
                  <input
                    value={logNote}
                    onChange={(e) => setLogNote(e.target.value)}
                    placeholder="optional"
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button style={buttonStyle} onClick={() => setShowLogModal(false)}>
                    Cancel
                  </button>
                  <button
                    style={{
                      ...buttonStyle,
                      background: "#111827",
                      borderColor: "rgba(255,255,255,0.18)",
                    }}
                    onClick={saveLog}
                  >
                    Save Log
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}