"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Role = "owner" | "admin" | "member";

type CurrentRateRow = {
  aircraft_id: string;
  hourly_rate: number;
  effective_from: string; // date
};

type MonthlyRow = {
  aircraft_id: string;
  month: string; // date
  total_hours: number;
  total_income: number;
};

type AnnualRow = {
  aircraft_id: string;
  year: string; // date (Jan 1)
  total_hours: number;
  total_income: number;
};

function money(n: number | null | undefined) {
  if (n == null) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function num(n: number | null | undefined) {
  if (n == null) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

export default function RentalRevenuePanel({
  aircraftId,
  myRole,
}: {
  aircraftId: string;
  myRole: Role | null;
}) {
  const canEdit = myRole === "owner" || myRole === "admin";

  const [loading, setLoading] = useState(true);
  const [currentRate, setCurrentRate] = useState<CurrentRateRow | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [annual, setAnnual] = useState<AnnualRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Modal state (log rental)
  const [logOpen, setLogOpen] = useState(false);
  const [logDate, setLogDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [logHours, setLogHours] = useState<string>("1.0");
  const [logNote, setLogNote] = useState<string>("");

  // Modal state (set rate) - optional but useful
  const [rateOpen, setRateOpen] = useState(false);
  const [newRate, setNewRate] = useState<string>("");
  const [rateEffective, setRateEffective] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const now = useMemo(() => new Date(), []);
  const thisMonthKey = useMemo(() => {
    const d = new Date();
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    return first.toISOString().slice(0, 10);
  }, []);
  const thisYearKey = useMemo(() => {
    const d = new Date();
    const first = new Date(d.getFullYear(), 0, 1);
    return first.toISOString().slice(0, 10);
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const [rateRes, monthRes, yearRes] = await Promise.all([
        supabase
          .from("v_aircraft_rental_current_rate")
          .select("aircraft_id,hourly_rate,effective_from")
          .eq("aircraft_id", aircraftId)
          .maybeSingle(),

        supabase
          .from("v_aircraft_rental_monthly")
          .select("aircraft_id,month,total_hours,total_income")
          .eq("aircraft_id", aircraftId)
          .order("month", { ascending: true }),

        supabase
          .from("v_aircraft_rental_annual")
          .select("aircraft_id,year,total_hours,total_income")
          .eq("aircraft_id", aircraftId)
          .order("year", { ascending: true }),
      ]);

      if (rateRes.error) throw rateRes.error;
      if (monthRes.error) throw monthRes.error;
      if (yearRes.error) throw yearRes.error;

      setCurrentRate((rateRes.data as any) ?? null);
      setMonthly((monthRes.data as any) ?? []);
      setAnnual((yearRes.data as any) ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load rental revenue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!aircraftId) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraftId]);

  const thisMonth = useMemo(() => monthly.find((m) => m.month === thisMonthKey) ?? null, [monthly, thisMonthKey]);
  const thisYear = useMemo(() => annual.find((a) => a.year === thisYearKey) ?? null, [annual, thisYearKey]);

  async function submitLog() {
    setError(null);

    const hoursNum = Number(logHours);
    if (!logDate) return setError("Pick a rental date.");
    if (!Number.isFinite(hoursNum) || hoursNum <= 0) return setError("Hours must be > 0.");

    const { error: rpcErr } = await supabase.rpc("add_rental_log", {
      p_aircraft_id: aircraftId,
      p_rental_date: logDate,
      p_hours: hoursNum,
      p_note: logNote || null,
    });

    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }

    setLogOpen(false);
    setLogNote("");
    setLogHours("1.0");
    await refresh();
  }

  async function submitRate() {
    setError(null);

    const rateNum = Number(newRate);
    if (!Number.isFinite(rateNum) || rateNum < 0) return setError("Rate must be a valid number (>= 0).");
    if (!rateEffective) return setError("Pick an effective date.");

    // Insert directly into rates table (RLS will enforce owner/admin)
    const { error: insErr } = await supabase.from("aircraft_rental_rates").insert({
      aircraft_id: aircraftId,
      hourly_rate: rateNum,
      effective_from: rateEffective,
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });

    if (insErr) {
      setError(insErr.message);
      return;
    }

    setRateOpen(false);
    setNewRate("");
    await refresh();
  }

  return (
    <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0 }}>Rental Income</h3>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            Track hours-based rental income for this aircraft.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {canEdit && (
            <>
              <button onClick={() => setRateOpen(true)} style={btn()}>
                Set Rate
              </button>
              <button onClick={() => setLogOpen(true)} style={btnPrimary()}>
                Log Rental Hours
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: "#fee2e2", color: "#991b1b" }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ marginTop: 14, color: "#6b7280" }}>Loading revenue…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
          <Card title="Current Hourly Rate" value={currentRate ? money(currentRate.hourly_rate) : "Not set"} sub={currentRate ? `Effective ${currentRate.effective_from}` : "Set a rate to start logging"} />
          <Card title="This Month" value={money(thisMonth?.total_income ?? 0)} sub={`${num(thisMonth?.total_hours ?? 0)} hours`} />
          <Card title="Year to Date" value={money(thisYear?.total_income ?? 0)} sub={`${num(thisYear?.total_hours ?? 0)} hours`} />
        </div>
      )}

      {/* LOG MODAL */}
      {logOpen && (
        <Modal title="Log Rental Hours" onClose={() => setLogOpen(false)}>
          <Field label="Rental Date">
            <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} style={input()} />
          </Field>

          <Field label="Hours">
            <input value={logHours} onChange={(e) => setLogHours(e.target.value)} placeholder="e.g. 2.5" style={input()} />
          </Field>

          <Field label="Note (optional)">
            <input value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="e.g. John Doe rental" style={input()} />
          </Field>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button onClick={() => setLogOpen(false)} style={btn()}>
              Cancel
            </button>
            <button onClick={submitLog} style={btnPrimary()}>
              Save Log
            </button>
          </div>
        </Modal>
      )}

      {/* RATE MODAL */}
      {rateOpen && (
        <Modal title="Set Hourly Rate" onClose={() => setRateOpen(false)}>
          <Field label="Hourly Rate (USD)">
            <input value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder="e.g. 165" style={input()} />
          </Field>

          <Field label="Effective From">
            <input type="date" value={rateEffective} onChange={(e) => setRateEffective(e.target.value)} style={input()} />
          </Field>

          <p style={{ marginTop: 10, color: "#6b7280", fontSize: 13 }}>
            Tip: if you change rates later, old logs keep their original rate snapshot.
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button onClick={() => setRateOpen(false)} style={btn()}>
              Cancel
            </button>
            <button onClick={submitRate} style={btnPrimary()}>
              Save Rate
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function Card({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
      <div style={{ color: "#6b7280", fontSize: 13 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{value}</div>
      <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 520, background: "white", borderRadius: 14, padding: 16 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 style={{ margin: 0 }}>{title}</h4>
          <button onClick={onClose} style={btn()}>
            Close
          </button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function btn(): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    background: "white",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer",
  };
}

function btnPrimary(): React.CSSProperties {
  return {
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer",
  };
}

function input(): React.CSSProperties {
  return {
    width: "100%",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "10px 12px",
    outline: "none",
  };
}