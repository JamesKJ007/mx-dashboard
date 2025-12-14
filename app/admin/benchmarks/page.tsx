"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type BenchmarkRow = {
  id: string;
  aircraft_type: string;
  hourly_cost: number;
  annual_cost: number | null;
  effective_date: string; // YYYY-MM-DD
};

export default function BenchmarksAdminPage() {
  const router = useRouter();

  // ---- Auth
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ---- Admin gate
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  // ---- Data
  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // ---- Create form
  const [aircraftType, setAircraftType] = useState("C172");
  const [hourlyCost, setHourlyCost] = useState("60");
  const [annualCost, setAnnualCost] = useState("12000");
  const [effectiveDate, setEffectiveDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  // ---- UI
  const pageWrap: CSSProperties = {
    padding: 20,
    maxWidth: 980,
    margin: "0 auto",
    color: "white",
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 10% 0%, rgba(56,189,248,0.12), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(168,85,247,0.12), transparent 55%), #0b1020",
  };

  const smallMuted: CSSProperties = { opacity: 0.75, fontSize: 12 };

  const card: CSSProperties = {
    padding: 14,
    borderRadius: 12,
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 14,
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
    fontWeight: 700,
  };

  // ---- Auth bootstrap
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      setAuthLoading(true);
      setError("");
      setInfo("");

      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        setUserId(null);
        setAuthLoading(false);
        setError(error.message);
        return;
      }

      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
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

  // ---- Admin check (runs when userId changes)
  useEffect(() => {
    let mounted = true;

    async function checkAdmin() {
      setAdminLoading(true);
      setError("");
      setInfo("");

      if (!userId) {
        if (!mounted) return;
        setIsAdmin(false);
        setAdminLoading(false);
        return;
      }

      // If app_admins table/policies are missing, you'll see the error here (good!)
      const { data, error } = await supabase
        .from("app_admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setIsAdmin(false);
        setAdminLoading(false);
        setError(`Admin check failed: ${error.message}`);
        return;
      }

      setIsAdmin(!!data);
      setAdminLoading(false);
      setInfo(!!data ? "Admin verified ✅" : "Not an admin ❌");
    }

    checkAdmin();

    return () => {
      mounted = false;
    };
  }, [userId]);

  async function loadRows() {
    setLoading(true);
    setError("");
    setInfo("");

    try {
      const { data, error } = await supabase
        .from("maintenance_benchmarks")
        .select("id, aircraft_type, hourly_cost, annual_cost, effective_date")
        .order("aircraft_type", { ascending: true })
        .order("effective_date", { ascending: false });

      if (error) throw error;
      setRows((data ?? []) as BenchmarkRow[]);
      setInfo("Loaded benchmarks ✅");
    } catch (e: any) {
      setError(e?.message ?? "Failed to load benchmarks.");
    } finally {
      setLoading(false);
    }
  }

  // load rows once admin is confirmed (and only once per admin=true)
  useEffect(() => {
    if (isAdmin) loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const grouped = useMemo(() => {
    const m = new Map<string, BenchmarkRow[]>();
    for (const r of rows) {
      const k = r.aircraft_type || "Unknown";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  async function addRow(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!userId) return setError("You must be logged in.");
    if (!isAdmin) return setError("Not authorized.");

    const hourly = Number(hourlyCost);
    const annual = annualCost.trim() === "" ? null : Number(annualCost);

    if (Number.isNaN(hourly) || hourly <= 0) return setError("Hourly cost must be a positive number.");
    if (annual !== null && (Number.isNaN(annual) || annual < 0)) return setError("Annual cost must be blank or >= 0.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) return setError("Effective date must be YYYY-MM-DD.");

    setSaving(true);
    try {
      const { error } = await supabase.from("maintenance_benchmarks").insert({
        aircraft_type: aircraftType.trim(),
        hourly_cost: hourly,
        annual_cost: annual,
        effective_date: effectiveDate,
      });

      if (error) throw error;

      setAircraftType("C172");
      setHourlyCost("60");
      setAnnualCost("12000");

      await loadRows();
      setInfo("Added ✅");
    } catch (e: any) {
      setError(e?.message ?? "Failed to add row.");
    } finally {
      setSaving(false);
    }
  }

  async function updateRow(id: string, patch: Partial<BenchmarkRow>) {
    setError("");
    setInfo("");
    if (!isAdmin) return setError("Not authorized.");

    setSaving(true);
    try {
      const { error } = await supabase
        .from("maintenance_benchmarks")
        .update(patch)
        .eq("id", id);

      if (error) throw error;

      await loadRows();
      setInfo("Saved ✅");
    } catch (e: any) {
      setError(e?.message ?? "Failed to update row.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(id: string) {
    setError("");
    setInfo("");
    if (!isAdmin) return setError("Not authorized.");

    setSaving(true);
    try {
      const { error } = await supabase.from("maintenance_benchmarks").delete().eq("id", id);
      if (error) throw error;

      await loadRows();
      setInfo("Deleted ✅");
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete row.");
    } finally {
      setSaving(false);
    }
  }

  const statusLine =
    authLoading ? "Checking login…" : userId ? `Logged in ✅ (${userId.slice(0, 8)}…)` : "Not logged in ❌";

  const adminLine =
    adminLoading ? "Checking admin…" : isAdmin ? "Admin ✅" : "Not admin ❌";

  return (
    <div style={pageWrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <button style={buttonStyle} onClick={() => router.push("/")}>← Back</button>
        <h1 style={{ margin: 0 }}>Admin · Industry Estimated Benchmarks</h1>
        <div style={{ width: 80 }} />
      </div>

      <div style={{ marginTop: 10, ...smallMuted }}>
        {statusLine} • {adminLine}
      </div>

      {!!error && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.25)", color: "#fecaca" }}>
          Error: {error}
        </div>
      )}

      {!!info && !error && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#bbf7d0" }}>
          {info}
        </div>
      )}

      {!authLoading && !userId && (
        <div style={card}>
          Please log in. (This page depends on Supabase auth.)
        </div>
      )}

      {!adminLoading && userId && !isAdmin && (
        <div style={card}>
          You’re logged in, but you’re not an admin for benchmarks.
          <div style={{ marginTop: 6, ...smallMuted }}>
            Fix is in SQL: add your user_id into <code>app_admins</code>.
          </div>
        </div>
      )}

      {isAdmin && (
        <>
          {/* Add row */}
          <div style={{ ...card, marginTop: 14 }}>
            <div style={smallMuted}>Add a new row (latest effective_date becomes active)</div>

            <form onSubmit={addRow} style={{ marginTop: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={smallMuted}>Aircraft Type</span>
                  <input style={inputStyle} value={aircraftType} onChange={(e) => setAircraftType(e.target.value)} placeholder="C172" />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={smallMuted}>Hourly ($/hr)</span>
                  <input style={inputStyle} value={hourlyCost} onChange={(e) => setHourlyCost(e.target.value)} placeholder="60" />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={smallMuted}>Annual ($/yr)</span>
                  <input style={inputStyle} value={annualCost} onChange={(e) => setAnnualCost(e.target.value)} placeholder="(optional)" />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={smallMuted}>Effective Date</span>
                  <input style={inputStyle} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} placeholder="YYYY-MM-DD" />
                </label>
              </div>

              <button type="submit" style={{ ...buttonStyle, marginTop: 12 }} disabled={saving}>
                {saving ? "Saving…" : "Add Industry Estimate"}
              </button>
            </form>
          </div>

          {/* List */}
          <div style={card}>
            <div style={smallMuted}>Existing rows (edit inline)</div>

            {loading ? (
              <div style={{ marginTop: 10 }}>Loading…</div>
            ) : rows.length === 0 ? (
              <div style={{ marginTop: 10, opacity: 0.8 }}>No benchmark rows yet.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 14 }}>
                {grouped.map(([type, list]) => (
                  <div key={type} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>{type}</div>

                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                        <thead>
                          <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
                            <th style={{ padding: "8px 10px" }}>Effective</th>
                            <th style={{ padding: "8px 10px" }}>Hourly</th>
                            <th style={{ padding: "8px 10px" }}>Annual</th>
                            <th style={{ padding: "8px 10px" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((r) => (
                            <RowEditor
                              key={r.id}
                              row={r}
                              saving={saving}
                              onSave={(patch) => updateRow(r.id, patch)}
                              onDelete={() => deleteRow(r.id)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ marginTop: 8, ...smallMuted }}>
                      Tip: the app uses the latest <b>effective_date</b> as the active industry estimate.
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function RowEditor({
  row,
  saving,
  onSave,
  onDelete,
}: {
  row: BenchmarkRow;
  saving: boolean;
  onSave: (patch: Partial<BenchmarkRow>) => void;
  onDelete: () => void;
}) {
  const inputStyle: CSSProperties = {
    padding: 8,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    outline: "none",
    width: "100%",
  };

  const buttonStyle: CSSProperties = {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.10)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
  };

  const [effective, setEffective] = useState(row.effective_date);
  const [hourly, setHourly] = useState(String(row.hourly_cost));
  const [annual, setAnnual] = useState(row.annual_cost == null ? "" : String(row.annual_cost));

  return (
    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <td style={{ padding: "8px 10px", width: 160 }}>
        <input style={inputStyle} value={effective} onChange={(e) => setEffective(e.target.value)} />
      </td>

      <td style={{ padding: "8px 10px", width: 140 }}>
        <input style={inputStyle} value={hourly} onChange={(e) => setHourly(e.target.value)} />
      </td>

      <td style={{ padding: "8px 10px", width: 160 }}>
        <input style={inputStyle} value={annual} onChange={(e) => setAnnual(e.target.value)} placeholder="(blank ok)" />
      </td>

      <td style={{ padding: "8px 10px", width: 260 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            style={buttonStyle}
            disabled={saving}
            onClick={() => {
              const hourlyNum = Number(hourly);
              const annualNum = annual.trim() === "" ? null : Number(annual);

              if (!/^\d{4}-\d{2}-\d{2}$/.test(effective)) return alert("Effective date must be YYYY-MM-DD");
              if (Number.isNaN(hourlyNum) || hourlyNum <= 0) return alert("Hourly must be positive number");
              if (annualNum !== null && (Number.isNaN(annualNum) || annualNum < 0)) return alert("Annual must be blank or >= 0");

              onSave({ effective_date: effective, hourly_cost: hourlyNum, annual_cost: annualNum });
            }}
          >
            Save
          </button>

          <button
            style={{ ...buttonStyle, background: "rgba(239,68,68,0.18)", borderColor: "rgba(239,68,68,0.35)" }}
            disabled={saving}
            onClick={() => {
              if (confirm("Delete this row?")) onDelete();
            }}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}