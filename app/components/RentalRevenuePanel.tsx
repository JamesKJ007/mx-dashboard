"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import MonthlyRentalRevenueChart from "./MonthlyRentalRevenueChart";

type Role = "owner" | "admin" | "member";

type CurrentRateRow = {
  aircraft_id: string;
  hourly_rate: number;
  effective_from: string; // date
};

type MonthlyRow = {
  aircraft_id: string;
  month: string; // date (first day of month)
  total_hours: number;
  total_income: number;
};

type AnnualRow = {
  aircraft_id: string;
  year: string; // date (Jan 1)
  total_hours: number;
  total_income: number;
};

type LogRow = {
  id: string;
  aircraft_id: string;
  rental_date: string; // date
  hours: number;
  hourly_rate: number; // snapshot
  income: number; // snapshot (hours * rate)
  note: string | null;
  created_at: string;
};

function money(n: number | null | undefined) {
  const v = n ?? 0;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}
function num(n: number | null | undefined) {
  const v = n ?? 0;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);
}

export default function RentalRevenuePanel({
  aircraftId,
  myRole,
}: {
  aircraftId: string;
  myRole: Role | null;
}) {
  const canEdit = myRole === "owner" || myRole === "admin";

  const [collapsed, setCollapsed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);

  const [currentRate, setCurrentRate] = useState<CurrentRateRow | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [annual, setAnnual] = useState<AnnualRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);

  const [error, setError] = useState<string | null>(null);

  // LOG modal
  const [logOpen, setLogOpen] = useState(false);
  const [logDate, setLogDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [logHours, setLogHours] = useState<string>("1.0");
  const [logNote, setLogNote] = useState<string>("");

  // RATE modal
  const [rateOpen, setRateOpen] = useState(false);
  const [newRate, setNewRate] = useState<string>("");
  const [rateEffective, setRateEffective] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // EDIT modal
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<LogRow | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editHours, setEditHours] = useState("");
  const [editNote, setEditNote] = useState("");

  // DELETE modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<LogRow | null>(null);

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

  const thisMonth = useMemo(
    () => monthly.find((m) => m.month === thisMonthKey) ?? null,
    [monthly, thisMonthKey]
  );

  const thisYear = useMemo(
    () => annual.find((a) => a.year === thisYearKey) ?? null,
    [annual, thisYearKey]
  );

  async function refresh() {
    if (!aircraftId) return;

    setLoading(true);
    setLogsLoading(true);
    setError(null);

    try {
      const [rateRes, monthRes, yearRes, logsRes] = await Promise.all([
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

        supabase
          .from("aircraft_rental_logs")
          .select("id,aircraft_id,rental_date,hours,hourly_rate,income,note,created_at")
          .eq("aircraft_id", aircraftId)
          .order("rental_date", { ascending: false }),
      ]);

      if (rateRes.error) throw rateRes.error;
      if (monthRes.error) throw monthRes.error;
      if (yearRes.error) throw yearRes.error;
      if (logsRes.error) throw logsRes.error;

      setCurrentRate((rateRes.data as any) ?? null);
      setMonthly((monthRes.data as any) ?? []);
      setAnnual((yearRes.data as any) ?? []);
      setLogs((logsRes.data as any) ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load rental revenue");
    } finally {
      setLoading(false);
      setLogsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraftId]);

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

    if (rpcErr) return setError(rpcErr.message);

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

    const user = await supabase.auth.getUser();

    const { error: insErr } = await supabase.from("aircraft_rental_rates").insert({
      aircraft_id: aircraftId,
      hourly_rate: rateNum,
      effective_from: rateEffective,
      created_by: user.data.user?.id ?? null,
    });

    if (insErr) return setError(insErr.message);

    setRateOpen(false);
    setNewRate("");
    await refresh();
  }

  async function getRateForDate(dateISO: string) {
    // Find most recent rate effective on/before date
    const res = await supabase
      .from("aircraft_rental_rates")
      .select("hourly_rate,effective_from")
      .eq("aircraft_id", aircraftId)
      .lte("effective_from", dateISO)
      .order("effective_from", { ascending: false })
      .limit(1);

    if (res.error) throw res.error;
    const row: any = res.data?.[0];
    return row?.hourly_rate ?? currentRate?.hourly_rate ?? 0;
  }

  return (
    <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginTop: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
       <button
  onClick={() => setCollapsed((v) => !v)}
  aria-label={collapsed ? "Expand rental income" : "Collapse rental income"}
  title={collapsed ? "Expand" : "Collapse"}
  style={{
    width: 36,
    height: 36,
    borderRadius: 12,
    border: "1px solid #374151",
    background: "#1f2937",
    color: "#e5e7eb",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 700,
  }}
>
  {collapsed ? "▸" : "▾"}
</button>

          <div>
            <h3 style={{ margin: 0 }}>Rental Income</h3>
            <p style={{ margin: "6px 0 0", color: "#6b7280" }}>Track hours-based rental income for this aircraft.</p>
          </div>
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

      {/* Errors */}
      {error && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: "#fee2e2", color: "#991b1b" }}>
          {error}
        </div>
      )}

      {/* Body */}
      {!collapsed && (
        <>
          {loading ? (
            <p style={{ marginTop: 14, color: "#6b7280" }}>Loading revenue…</p>
          ) : (
            <>
              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
                <Card
                  title="Current Hourly Rate"
                  value={currentRate ? money(currentRate.hourly_rate) : "Not set"}
                  sub={currentRate ? `Effective ${currentRate.effective_from}` : "Set a rate to start logging"}
                />
                <Card title="This Month" value={money(thisMonth?.total_income ?? 0)} sub={`${num(thisMonth?.total_hours ?? 0)} hours`} />
                <Card title="Year to Date" value={money(thisYear?.total_income ?? 0)} sub={`${num(thisYear?.total_hours ?? 0)} hours`} />
              </div>

              {/* Monthly chart */}
              <MonthlyRentalRevenueChart monthly={monthly} monthsToShow={6} />

              {/* Logs table */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>Rental Logs</div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>{logs.length} entries</div>
                </div>

                {logsLoading ? (
                  <div style={{ color: "#6b7280" }}>Loading logs…</div>
                ) : logs.length === 0 ? (
                  <div style={{ color: "#6b7280" }}>No rental logs yet.</div>
                ) : (
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: canEdit ? "1.1fr 0.6fr 0.7fr 0.8fr 1.3fr 0.8fr" : "1.1fr 0.6fr 0.7fr 0.8fr 1.3fr",
                        padding: 10,
                        background: "#f9fafb",
                        fontSize: 13,
                        color: "#374151",
                      }}
                    >
                      <div>Date</div>
                      <div>Hours</div>
                      <div>Rate</div>
                      <div>Income</div>
                      <div>Note</div>
                      {canEdit && <div style={{ textAlign: "right" }}>Actions</div>}
                    </div>

                    {logs.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: canEdit ? "1.1fr 0.6fr 0.7fr 0.8fr 1.3fr 0.8fr" : "1.1fr 0.6fr 0.7fr 0.8fr 1.3fr",
                          padding: 10,
                          borderTop: "1px solid #e5e7eb",
                          alignItems: "center",
                          fontSize: 14,
                        }}
                      >
                        <div>{r.rental_date}</div>
                        <div>{num(r.hours)}</div>
                        <div>{money(r.hourly_rate)}</div>
                        <div>{money(r.income)}</div>
                        <div style={{ color: "#6b7280" }}>{r.note ?? "-"}</div>

                        {canEdit && (
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                            <button
                              style={btn()}
                              onClick={() => {
                                setEditRow(r);
                                setEditDate(r.rental_date);
                                setEditHours(String(r.hours));
                                setEditNote(r.note ?? "");
                                setEditOpen(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              style={btn()}
                              onClick={() => {
                                setDeleteRow(r);
                                setDeleteOpen(true);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
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
            Tip: changing rates later won’t rewrite previous log snapshots.
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

      {/* EDIT MODAL */}
      {editOpen && editRow && (
        <Modal title="Edit Rental Log" onClose={() => setEditOpen(false)}>
          <Field label="Rental Date">
            <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={input()} />
          </Field>

          <Field label="Hours">
            <input value={editHours} onChange={(e) => setEditHours(e.target.value)} style={input()} />
          </Field>

          <Field label="Note (optional)">
            <input value={editNote} onChange={(e) => setEditNote(e.target.value)} style={input()} />
          </Field>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button onClick={() => setEditOpen(false)} style={btn()}>
              Cancel
            </button>
            <button
              onClick={async () => {
                setError(null);

                const h = Number(editHours);
                if (!editDate) return setError("Pick a date.");
                if (!Number.isFinite(h) || h <= 0) return setError("Hours must be > 0.");

                try {
                  const rate = await getRateForDate(editDate);
                  const income = h * rate;

                  const { error: updErr } = await supabase
                    .from("aircraft_rental_logs")
                    .update({
                      rental_date: editDate,
                      hours: h,
                      note: editNote || null,
                      hourly_rate: rate,
                      income,
                    })
                    .eq("id", editRow.id);

                  if (updErr) return setError(updErr.message);

                  setEditOpen(false);
                  setEditRow(null);
                  await refresh();
                } catch (e: any) {
                  setError(e?.message ?? "Failed to update log");
                }
              }}
              style={btnPrimary()}
            >
              Save Changes
            </button>
          </div>
        </Modal>
      )}

      {/* DELETE CONFIRM */}
      {deleteOpen && deleteRow && (
        <Modal title="Delete Rental Log" onClose={() => setDeleteOpen(false)}>
          <p style={{ color: "#374151", marginTop: 0 }}>
            Delete log on <b>{deleteRow.rental_date}</b> for <b>{num(deleteRow.hours)}</b> hours?
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button onClick={() => setDeleteOpen(false)} style={btn()}>
              Cancel
            </button>
            <button
              onClick={async () => {
                setError(null);

                const { error: delErr } = await supabase.from("aircraft_rental_logs").delete().eq("id", deleteRow.id);
                if (delErr) return setError(delErr.message);

                setDeleteOpen(false);
                setDeleteRow(null);
                await refresh();
              }}
              style={btnPrimary()}
            >
              Confirm Delete
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

/* UI Helpers */
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
  children: ReactNode;
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
        style={{ width: "100%", maxWidth: 560, background: "white", borderRadius: 14, padding: 16 }}
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function btn(): React.CSSProperties {
  return {
    border: "1px solid #374151",
    background: "#1f2937",
    color: "#e5e7eb",
    padding: "8px 14px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 500,
  };
}

function btnPrimary(): React.CSSProperties {
  return {
    border: "1px solid #374151",
    background: "#1f2937",
    color: "white",
    padding: "8px 14px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 600,
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
