"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import MonthlyCostChart from "@/app/components/MonthlyCostChart";
import CostPerHourTrendChart from "@/app/components/CostPerHourTrendChart";

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
  entry_date: string | null;
  category: string | null;
  amount: number | null;
  tach_hours: number | null;
  notes: string | null;
  created_at: string;
};

export default function AircraftMaintenancePage() {
  const params = useParams();

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

  // ---- Form
  const [entryDate, setEntryDate] = useState("");
  const [category, setCategory] = useState("Maintenance");
  const [amount, setAmount] = useState("");
  const [tachHours, setTachHours] = useState("");
  const [notes, setNotes] = useState("");

  // If Supabase has a category constraint, these MUST match exactly
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

  // ---- Auth bootstrap (and live changes)
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

  // ---- Load aircraft + entries
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

  // ---- Calculations (tach-based)
  const totalSpend = useMemo(() => {
    return entries.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  }, [entries]);

  const tachValues = useMemo(() => {
    return entries
      .map((e) => e.tach_hours)
      .filter((v): v is number => typeof v === "number")
      .sort((a, b) => a - b);
  }, [entries]);

  const hoursFlown = useMemo(() => {
    if (tachValues.length < 2) return 0;
    return tachValues[tachValues.length - 1] - tachValues[0];
  }, [tachValues]);

  const costPerHour = useMemo(() => {
    return hoursFlown > 0 ? totalSpend / hoursFlown : null;
  }, [hoursFlown, totalSpend]);

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

    // Tach Safety (prevents backwards hours)
    const latestTach = entries
      .map((x) => x.tach_hours)
      .filter((v): v is number => typeof v === "number")
      .sort((a, b) => b - a)[0];

    if (typeof tachNum === "number" && typeof latestTach === "number" && tachNum < latestTach) {
      setSaving(false);
      return setError(`Tach hours cannot go backwards. Latest recorded tach is ${latestTach}.`);
    }

    // If entering cost, require tach (optional rule — remove if you don’t want it)
    if (amountNum !== null && tachNum === null) {
      setSaving(false);
      return setError("Tach hours are required when entering a cost.");
    }

    const safeCategory = ALLOWED_CATEGORIES.includes(category) ? category : "Maintenance";

    const payload = {
      user_id: userId,
      aircraft_id: aircraftId,
      entry_date: entryDate.trim() === "" ? null : entryDate.trim(),
      category: safeCategory,
      amount: amountNum,
      tach_hours: tachNum,
      notes: notes.trim() === "" ? null : notes.trim(),
    };

    const { error: insErr } = await supabase.from("maintenance_entries").insert(payload);

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
  }

  return (
    <div
      style={{
        ...pageWrap,
        background:
          "radial-gradient(1200px 600px at 10% 0%, rgba(56,189,248,0.12), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(168,85,247,0.12), transparent 55%), #0b1020",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ marginBottom: 6 }}>Aircraft MX ✈️</h1>

      <div style={{ opacity: 0.9, marginBottom: 14 }}>
        {authLoading ? "Checking login…" : userId ? "Logged in ✅" : "Not logged in ❌"}
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
            {aircraft.tail_number ?? "Untitled"} {aircraft.model ? `— ${aircraft.model}` : ""}
          </div>
        ) : (
          <div style={{ fontSize: 14, opacity: 0.9 }}>
            Couldn’t find aircraft for id: <code>{String(aircraftId)}</code>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ ...cardDark, flex: 1, minWidth: 220 }}>
          <div style={smallMuted}>Total Spend</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>${totalSpend.toFixed(2)}</div>
        </div>

        <div style={{ ...cardDark, flex: 1, minWidth: 220 }}>
          <div style={smallMuted}>Hours Logged</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{hoursFlown.toFixed(1)}</div>
        </div>

        <div style={{ ...cardDark, flex: 1, minWidth: 220 }}>
          <div style={smallMuted}>Cost / Hour</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>
            {costPerHour ? `$${costPerHour.toFixed(2)}` : "—"}
          </div>
        </div>
      </div>

      {/* ✅ CHART (this is the JSX you were missing) */}
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        {/* Add Entry */}
        <div style={cardLight}>
          <h2 style={{ marginTop: 0, marginBottom: 12 }}>Add Maintenance Entry</h2>

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
                <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
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

            <button type="submit" style={{ ...buttonStyle, marginTop: 12 }} disabled={saving}>
              {saving ? "Saving…" : "+ Add Entry"}
            </button>
          </form>
        </div>

        {/* Entries */}
        <div style={cardLight}>
          <h2 style={{ marginTop: 0, marginBottom: 12 }}>Entries</h2>

          {loading ? (
            <div>Loading…</div>
          ) : entries.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No entries yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
                    <th style={{ padding: "8px 10px" }}>Date</th>
                    <th style={{ padding: "8px 10px" }}>Category</th>
                    <th style={{ padding: "8px 10px" }}>Amount</th>
                    <th style={{ padding: "8px 10px" }}>Tach</th>
                    <th style={{ padding: "8px 10px" }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <td style={{ padding: "8px 10px" }}>{e.entry_date ?? "-"}</td>
                      <td style={{ padding: "8px 10px" }}>{e.category ?? "-"}</td>
                      <td style={{ padding: "8px 10px" }}>
                        {typeof e.amount === "number" ? `$${e.amount.toFixed(2)}` : "-"}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        {typeof e.tach_hours === "number" ? e.tach_hours : "-"}
                      </td>
                      <td style={{ padding: "8px 10px" }}>{e.notes ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 10, ...smallMuted }}>
            Next: per-aircraft dashboard + monthly stacked chart + better filters.
          </div>
        </div>
      </div>
    </div>
  );
}