"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import MonthlyCostChart from "../../components/MonthlyCostChart";
import CostPerHourTrendChart from "../../components/CostPerHourTrendChart";

type AircraftRow = {
  id: string;
  user_id: string;
  tail_number: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  created_at?: string;
};

type MxEntryRow = {
  id: string;
  user_id: string;
  aircraft_id: string;
  entry_date: string | null; // YYYY-MM-DD
  category: string | null;
  amount: number | null;
  tach_hours: number | null;
  notes: string | null;
  created_at: string;
};

type BenchmarkRow = {
  id: string;
  aircraft_type: string;
  hourly_cost: number;
  annual_cost: number | null;
  effective_date: string; // YYYY-MM-DD
};

export default function AircraftMaintenancePage() {
  const params = useParams();
  const router = useRouter();

  const aircraftId = useMemo(() => {
    const raw = (params as any)?.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  // ---- Auth
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ---- Data
  const [aircraft, setAircraft] = useState<AircraftRow | null>(null);
  const [entries, setEntries] = useState<MxEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  // ✅ Benchmark
  const [benchmark, setBenchmark] = useState<BenchmarkRow | null>(null);

  // ---- Form
  const [entryDate, setEntryDate] = useState("");
  const [category, setCategory] = useState("Maintenance");
  const [amount, setAmount] = useState("");
  const [tachHours, setTachHours] = useState("");
  const [notes, setNotes] = useState("");

  // ✅ Toggle panel for Add Entry
  const [showAddEntry, setShowAddEntry] = useState(false);

  const ALLOWED_CATEGORIES = [
    "Maintenance",
    "Oil Change",
    "Annual",
    "Tires",
    "Brakes",
    "Avionics",
    "Engine",
    "Inspection",
    "Other",
  ];

  // ---- Styles
  const pageWrap: CSSProperties = {
    padding: 20,
    maxWidth: 980,
    margin: "0 auto",
    color: "white",
  };

  const smallMuted: CSSProperties = { opacity: 0.75, fontSize: 12 };

  const cardDark: CSSProperties = {
    padding: 14,
    borderRadius: 12,
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.08)",
  };

  const cardLight: CSSProperties = {
    padding: 14,
    borderRadius: 12,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(6px)",
  };

  const inputStyle: CSSProperties = {
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    outline: "none",
  };

  const buttonStyle: CSSProperties = {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.10)",
    color: "white",
    cursor: "pointer",
    fontWeight: 600,
  };

  const ghostButton: CSSProperties = {
    ...buttonStyle,
    background: "transparent",
  };

  // ---- Auth bootstrap
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      setAuthLoading(true);
      setError("");

      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        setUserId(null);
        setAuthLoading(false);
        return;
      }

      setUserId(data.session?.user?.id ?? null);
      setAuthLoading(false);
    }

    initAuth();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // ---- Load aircraft + entries + benchmark
  async function loadAll() {
    if (!aircraftId) return;

    setLoading(true);
    setError("");

    try {
      const { data: aircraftData, error: aircraftErr } = await supabase
        .from("aircraft")
        .select("id, user_id, tail_number, make, model, year, created_at")
        .eq("id", aircraftId)
        .maybeSingle();

      if (aircraftErr) throw aircraftErr;
      setAircraft(aircraftData ?? null);

      const { data: entryData, error: entryErr } = await supabase
        .from("maintenance_entries")
        .select(
          "id, user_id, aircraft_id, entry_date, category, amount, tach_hours, notes, created_at"
        )
        .eq("aircraft_id", aircraftId)
        .order("entry_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (entryErr) throw entryErr;
      setEntries(entryData ?? []);

      // ✅ Load benchmark (latest row, forgiving aircraft_type values)
      const { data: benchData, error: benchErr } = await supabase
        .from("maintenance_benchmarks")
        .select("id, aircraft_type, hourly_cost, annual_cost, effective_date")
        .in("aircraft_type", ["C172", "172", "C172N", "172N"])
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (benchErr) throw benchErr;
      setBenchmark(benchData ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraftId]);

  // ---- Calculations (All-time)
  const totalSpend = useMemo(
    () => entries.reduce((sum, e) => sum + (e.amount ?? 0), 0),
    [entries]
  );

  const tachValues = useMemo(() => {
    return entries
      .map((e) => e.tach_hours)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
      .sort((a, b) => a - b);
  }, [entries]);

  const hoursFlown = useMemo(() => {
    if (tachValues.length < 2) return 0;
    const diff = tachValues[tachValues.length - 1] - tachValues[0];
    return diff > 0 ? diff : 0;
  }, [tachValues]);

  const costPerHour = useMemo(() => {
    return hoursFlown > 0 ? totalSpend / hoursFlown : null;
  }, [hoursFlown, totalSpend]);

  // ✅ benchmark comparison
  const benchmarkCompare = useMemo(() => {
    if (!benchmark) return null;
    if (benchmark.hourly_cost <= 0) return null;
    if (costPerHour == null) return null;

    const diff = costPerHour - benchmark.hourly_cost;
    const pct = (diff / benchmark.hourly_cost) * 100;

    return {
      diff,
      pct,
      above: diff > 0,
      equalish: Math.abs(pct) < 0.5,
    };
  }, [benchmark, costPerHour]);

  // ✅ R/Y/G status for benchmark (based on % off)
  const benchmarkStatus = useMemo(() => {
    if (!benchmarkCompare) return null;

    const absPct = Math.abs(benchmarkCompare.pct);

    if (absPct <= 10) return { label: "On track", color: "#22c55e" }; // green
    if (absPct <= 25) return { label: "Watch", color: "#f59e0b" }; // yellow
    return { label: "High", color: "#ef4444" }; // red
  }, [benchmarkCompare]);

  async function addEntry(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!userId) return setError("You must be logged in to add an entry.");
    if (!aircraftId) return setError("Missing aircraft id in URL.");

    setSaving(true);

    const amountNum = amount.trim() === "" ? null : Number(amount);
    const tachNum = tachHours.trim() === "" ? null : Number(tachHours);

    if (amountNum !== null && Number.isNaN(amountNum)) {
      setSaving(false);
      return setError("Amount must be a number.");
    }
    if (tachNum !== null && Number.isNaN(tachNum)) {
      setSaving(false);
      return setError("Tach Hours must be a number.");
    }

    const latestTach = entries
      .map((x) => x.tach_hours)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
      .sort((a, b) => b - a)[0];

    if (
      typeof tachNum === "number" &&
      typeof latestTach === "number" &&
      tachNum < latestTach
    ) {
      setSaving(false);
      return setError(
        `Tach hours cannot go backwards. Latest recorded tach is ${latestTach}.`
      );
    }

    if (amountNum !== null && tachNum === null) {
      setSaving(false);
      return setError("Tach hours are required when entering a cost.");
    }

    const safeCategory = ALLOWED_CATEGORIES.includes(category)
      ? category
      : "Maintenance";

    const payload = {
      user_id: userId,
      aircraft_id: aircraftId,
      entry_date: entryDate.trim() === "" ? null : entryDate.trim(),
      category: safeCategory,
      amount: amountNum,
      tach_hours: tachNum,
      notes: notes.trim() === "" ? null : notes.trim(),
    };

    const { error: insErr } = await supabase
      .from("maintenance_entries")
      .insert(payload);

    if (insErr) {
      setSaving(false);
      return setError(insErr.message);
    }

    await loadAll();

    setEntryDate("");
    setCategory("Maintenance");
    setAmount("");
    setTachHours("");
    setNotes("");
    setSaving(false);

    setShowAddEntry(false);
  }

  // ✅ Group entries by YEAR
  const entriesByYear = useMemo(() => {
    const withDates = entries.filter((e) => !!e.entry_date);

    const withoutDates = entries
      .filter((e) => !e.entry_date)
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

    const sorted = [...withDates].sort((a, b) =>
      (b.entry_date ?? "").localeCompare(a.entry_date ?? "")
    );

    const groups: { year: string; rows: MxEntryRow[] }[] = [];

    for (const row of sorted) {
      const year = (row.entry_date ?? "").slice(0, 4) || "Unknown";
      const last = groups[groups.length - 1];

      if (!last || last.year !== year) {
        groups.push({ year, rows: [row] });
      } else {
        last.rows.push(row);
      }
    }

    if (withoutDates.length > 0) {
      groups.push({ year: "No Date", rows: withoutDates });
    }

    return groups;
  }, [entries]);

  return (
    <div
      style={{
        ...pageWrap,
        background:
          "radial-gradient(1200px 600px at 10% 0%, rgba(56,189,248,0.12), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(168,85,247,0.12), transparent 55%), #0b1020",
        minHeight: "100vh",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <button style={ghostButton} onClick={() => router.push("/")}>
          ← Back to Aircraft
        </button>

        <h1 style={{ margin: 0 }}>Aircraft MX ✈️</h1>

        <div style={{ width: 160 }} />
      </div>

      <div style={{ opacity: 0.9, marginBottom: 14 }}>
        {authLoading
          ? "Checking login…"
          : userId
          ? "Logged in ✅"
          : "Not logged in ❌"}
      </div>

      {!!error && (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 12,
            background: "rgba(239, 68, 68, 0.14)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "#fecaca",
          }}
        >
          Error: {error}
        </div>
      )}

      {/* Aircraft Card */}
      <div style={{ ...cardDark, marginBottom: 14 }}>
        <div style={smallMuted}>Aircraft</div>
        {loading ? (
          <div>Loading…</div>
        ) : aircraft ? (
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            {aircraft.tail_number ?? "Untitled"}
            {aircraft.model ? ` — ${aircraft.model}` : ""}
          </div>
        ) : (
          <div style={{ fontSize: 14, opacity: 0.9 }}>
            Couldn’t find aircraft for id: <code>{String(aircraftId)}</code>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ ...cardDark, flex: 1, minWidth: 220 }}>
          <div style={smallMuted}>Total Spend</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>
            ${totalSpend.toFixed(2)}
          </div>
        </div>

        <div style={{ ...cardDark, flex: 1, minWidth: 220 }}>
          <div style={smallMuted}>Hours Logged</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>
            {hoursFlown.toFixed(1)}
          </div>
        </div>

        <div style={{ ...cardDark, flex: 1, minWidth: 220 }}>
          <div style={smallMuted}>Cost / Hour</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>
            {costPerHour != null ? `$${costPerHour.toFixed(2)}` : "—"}
          </div>
        </div>
      </div>

      {/* ✅ Benchmark Card (R/Y/G lives ONLY here) */}
      <div style={{ ...cardDark, marginBottom: 18 }}>
        <div style={smallMuted}>Industry Estimated Benchmark (C172)</div>

        {!benchmark ? (
          <div style={{ marginTop: 8, opacity: 0.85 }}>
            No industry estimate found yet. Add one to{" "}
<code>maintenance_benchmarks</code> for{" "}
<b>aircraft_type = "C172"</b> (or 172 / 172N / C172N).
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>
              Avg: ${benchmark.hourly_cost.toFixed(2)} / hr{" "}
              {benchmark.annual_cost != null
                ? ` • $${benchmark.annual_cost.toFixed(0)} / yr`
                : ""}
            </div>

            <div
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {benchmarkCompare ? (
                <>
                  {/* ✅ Status pill */}
                  {benchmarkStatus && (
                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontWeight: 900,
                        fontSize: 12,
                        border: `1px solid ${benchmarkStatus.color}66`,
                        background: `${benchmarkStatus.color}35`,
                        color: benchmarkStatus.color,
                      }}
                    >
                      {benchmarkStatus.label}
                    </span>
                  )}

                  <span style={{ opacity: 0.92 }}>
                    {benchmarkCompare.equalish ? (
                      <>You’re basically right on average ✅</>
                    ) : benchmarkCompare.above ? (
                      <>
                        You’re <b>{Math.abs(benchmarkCompare.pct).toFixed(1)}%</b>{" "}
above the industry estimate (≈ ${benchmarkCompare.diff.toFixed(2)} / hr) 📈
                      </>
                    ) : (
                      <>
                        You’re <b>{Math.abs(benchmarkCompare.pct).toFixed(1)}%</b>{" "}
                        below the industry estimate (≈ $
                        {Math.abs(benchmarkCompare.diff).toFixed(2)} / hr) 📉
                      </>
                    )}
                  </span>
                </>
              ) : (
                <span style={{ opacity: 0.85 }}>
                  Add more entries with Amount + Tach (at least 2 different tach
                  values) to compare.
                </span>
              )}
            </div>

            <div style={{ marginTop: 6, ...smallMuted }}>
              Effective: {benchmark.effective_date}
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      <div style={{ ...cardDark, marginBottom: 18 }}>
        <div style={smallMuted}>Monthly Spend</div>
        <div style={{ marginTop: 10 }}>
          <MonthlyCostChart entries={entries} />
        </div>
      </div>

      <div style={{ ...cardDark, marginBottom: 18 }}>
        <div style={smallMuted}>Cost / Hour Trend</div>
        <div style={{ marginTop: 10 }}>
          <CostPerHourTrendChart entries={entries} />
        </div>
      </div>

      {/* Entries table */}
      <div style={cardLight}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>Entries</h2>

          <button
            style={buttonStyle}
            onClick={() => setShowAddEntry((v) => !v)}
          >
            {showAddEntry ? "Close" : "+ Add Entry"}
          </button>
        </div>

        {showAddEntry && (
          <div style={{ ...cardDark, marginBottom: 14 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>
              Add Maintenance Entry
            </h3>

            <form onSubmit={addEntry}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={smallMuted}>Date</span>
                  <input
                    style={inputStyle}
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    placeholder="YYYY-MM-DD"
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={smallMuted}>Category</span>
                  <select
                    style={inputStyle}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {ALLOWED_CATEGORIES.map((c) => (
                      <option key={c} value={c} style={{ color: "black" }}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={smallMuted}>Amount ($)</span>
                  <input
                    style={inputStyle}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 245.00"
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={smallMuted}>Tach Hours</span>
                  <input
                    style={inputStyle}
                    value={tachHours}
                    onChange={(e) => setTachHours(e.target.value)}
                    placeholder="e.g. 1834.6"
                  />
                </label>

                <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                  <span style={smallMuted}>Notes</span>
                  <input
                    style={inputStyle}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What was done?"
                  />
                </label>
              </div>

              <button
                type="submit"
                style={{ ...buttonStyle, marginTop: 12 }}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Entry"}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No entries yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <th style={{ padding: "8px 10px" }}>Date</th>
                  <th style={{ padding: "8px 10px" }}>Category</th>
                  <th style={{ padding: "8px 10px" }}>Amount</th>
                  <th style={{ padding: "8px 10px" }}>Tach</th>
                  <th style={{ padding: "8px 10px" }}>Notes</th>
                </tr>
              </thead>

              <tbody>
                {entriesByYear.map((group, idx) => (
                  <Fragment key={group.year}>
                    {idx !== 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: 0, height: 12 }} />
                      </tr>
                    )}

                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: "14px 10px 6px",
                          fontWeight: 900,
                          color: "#e5e7eb",
                          letterSpacing: 0.5,
                          borderBottom: "1px solid rgba(255,255,255,0.10)",
                        }}
                      >
                        {group.year}
                      </td>
                    </tr>

                    {group.rows.map((e) => (
                      <tr
                        key={e.id}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <td style={{ padding: "8px 10px" }}>
                          {e.entry_date ?? "-"}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {e.category ?? "-"}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {typeof e.amount === "number"
                            ? `$${e.amount.toFixed(2)}`
                            : "-"}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {typeof e.tach_hours === "number" ? e.tach_hours : "-"}
                        </td>
                        <td style={{ padding: "8px 10px" }}>{e.notes ?? "-"}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 10, ...smallMuted }}>
          Next: per-aircraft dashboard + better filters.
        </div>
      </div>
    </div>
  );
}