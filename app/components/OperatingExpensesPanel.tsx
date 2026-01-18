"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MyRole = "owner" | "admin" | "member" | null;

type OpExpenseRow = {
  id: string;
  aircraft_id: string;
  entry_date: string; // YYYY-MM-DD
  category: "insurance" | "fuel" | "hangar_tiedown" | "misc";
  amount: number;
  note: string | null;
  created_by: string | null;
  created_at?: string;
};

function money(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function OperatingExpensesPanel({
  aircraftId,
  myRole,
}: {
  aircraftId: string;
  myRole: MyRole;
}) {
  const canEdit = myRole === "owner" || myRole === "admin";

  const [rows, setRows] = useState<OpExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [date, setDate] = useState(ymd(new Date()));
  const [category, setCategory] = useState<OpExpenseRow["category"]>("fuel");
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>("");
  const [editCategory, setEditCategory] = useState<OpExpenseRow["category"]>("fuel");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");

  // menu
  const [menuId, setMenuId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("aircraft_operating_expenses")
      .select("id, aircraft_id, entry_date, category, amount, note, created_by, created_at")
      .eq("aircraft_id", aircraftId)
      .order("entry_date", { ascending: false });

    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as OpExpenseRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!aircraftId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraftId]);

  const totalsByCat = useMemo(() => {
    const out = { insurance: 0, fuel: 0, hangar_tiedown: 0, misc: 0, total: 0 };
    for (const r of rows) {
      const amt = Number(r.amount) || 0;
      out[r.category] += amt;
      out.total += amt;
    }
    return out;
  }, [rows]);

  function startEdit(r: OpExpenseRow) {
    setMenuId(null);
    setEditingId(r.id);
    setEditDate(r.entry_date);
    setEditCategory(r.category);
    setEditAmount(String(r.amount ?? ""));
    setEditNote(r.note ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDate("");
    setEditCategory("fuel");
    setEditAmount("");
    setEditNote("");
  }

  async function addExpense() {
    if (!canEdit) return;

    setErr(null);
    setSaving(true);

    const amt = Number(amount);
    if (!date) {
      setErr("Date is required.");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr("Amount must be a positive number.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("aircraft_operating_expenses").insert({
      aircraft_id: aircraftId,
      entry_date: date,
      category,
      amount: amt,
      note: note.trim() === "" ? null : note.trim(),
    });

    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }

    setShowAdd(false);
    setAmount("");
    setNote("");
    await load();
    setSaving(false);
  }

  async function saveEdit(id: string) {
    if (!canEdit) return;

    setErr(null);
    setSaving(true);

    const amt = Number(editAmount);
    if (!editDate) {
      setErr("Date is required.");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr("Amount must be a positive number.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("aircraft_operating_expenses")
      .update({
        entry_date: editDate,
        category: editCategory,
        amount: amt,
        note: editNote.trim() === "" ? null : editNote.trim(),
      })
      .eq("id", id);

    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }

    await load();
    setSaving(false);
    cancelEdit();
  }

  async function deleteRow(id: string) {
    if (!canEdit) return;

    setMenuId(null);
    if (!confirm("Delete this operating expense?")) return;

    setErr(null);
    setSaving(true);

    const { error } = await supabase.from("aircraft_operating_expenses").delete().eq("id", id);

    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }

    await load();
    setSaving(false);
    if (editingId === id) cancelEdit();
  }

  const card: React.CSSProperties = {
    padding: 14,
    borderRadius: 12,
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 14,
  };

  const smallMuted: React.CSSProperties = { opacity: 0.75, fontSize: 12 };

  const btn: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "#e5e7eb",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 800,
    cursor: "pointer",
  };

  const input: React.CSSProperties = {
    width: "100%",
    background: "rgba(2,6,23,0.85)",
    color: "#e5e7eb",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 10,
    padding: "10px 12px",
    outline: "none",
  };

  const tableInput: React.CSSProperties = {
    width: "100%",
    background: "rgba(2,6,23,0.85)",
    color: "#e5e7eb",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 10,
    padding: "8px 10px",
    outline: "none",
  };

  const iconBtn: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const menuWrap: React.CSSProperties = { position: "relative", display: "inline-block" };

  const menuPanel: React.CSSProperties = {
    position: "absolute",
    right: 0,
    top: 40,
    minWidth: 140,
    borderRadius: 12,
    background: "#0b1226",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
    zIndex: 50,
    overflow: "hidden",
  };

  const menuItem: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    background: "transparent",
    border: "none",
    color: "white",
    textAlign: "left",
    cursor: "pointer",
    fontWeight: 700,
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#e5e7eb", fontWeight: 900, fontSize: 16 }}>Operating Expenses</div>
          <div style={{ color: "#9ca3af", fontSize: 13 }}>Fuel, insurance, hangar/tiedown, etc. (separate from maintenance)</div>
        </div>

        {canEdit && (
          <button style={btn} onClick={() => setShowAdd((v) => !v)} disabled={saving}>
            {showAdd ? "Close" : "+ Add Expense"}
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <div style={{ ...smallMuted, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }}>
          Total: <b style={{ color: "#e5e7eb" }}>{money(totalsByCat.total)}</b>
        </div>
        <div style={{ ...smallMuted, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }}>
          Fuel: <b style={{ color: "#e5e7eb" }}>{money(totalsByCat.fuel)}</b>
        </div>
        <div style={{ ...smallMuted, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }}>
          Insurance: <b style={{ color: "#e5e7eb" }}>{money(totalsByCat.insurance)}</b>
        </div>
        <div style={{ ...smallMuted, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }}>
          Hangar/Tiedown: <b style={{ color: "#e5e7eb" }}>{money(totalsByCat.hangar_tiedown)}</b>
        </div>
        <div style={{ ...smallMuted, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }}>
          Misc: <b style={{ color: "#e5e7eb" }}>{money(totalsByCat.misc)}</b>
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#fecaca", fontWeight: 800 }}>
          {err}
        </div>
      )}

      {showAdd && canEdit && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={smallMuted}>Date</div>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={smallMuted}>Category</div>
              <select value={category} onChange={(e) => setCategory(e.target.value as any)} style={input}>
                <option value="fuel">Fuel</option>
                <option value="insurance">Insurance</option>
                <option value="hangar_tiedown">Hangar/Tiedown</option>
                <option value="misc">Misc</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={smallMuted}>Amount</div>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 325.50" style={input} />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={smallMuted}>Note (optional)</div>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" style={input} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
            <button style={btn} onClick={() => setShowAdd(false)} disabled={saving}>Cancel</button>
            <button style={{ ...btn, background: "#111827" }} onClick={addExpense} disabled={saving}>
              {saving ? "Saving…" : "Save Expense"}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {loading ? (
          <div style={{ opacity: 0.85 }}>Loading operating expenses…</div>
        ) : rows.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No operating expenses yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.06)" }}>
                  <th style={{ textAlign: "left", padding: 10, color: "#e5e7eb" }}>Date</th>
                  <th style={{ textAlign: "left", padding: 10, color: "#e5e7eb" }}>Category</th>
                  <th style={{ textAlign: "left", padding: 10, color: "#e5e7eb" }}>Amount</th>
                  <th style={{ textAlign: "left", padding: 10, color: "#e5e7eb" }}>Note</th>
                  <th style={{ textAlign: "left", padding: 10, color: "#e5e7eb", width: 120 }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const isEditing = editingId === r.id;

                  return (
                    <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <td style={{ padding: 10, color: "#e5e7eb", width: 160 }}>
                        {isEditing ? (
                          <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={tableInput} />
                        ) : (
                          r.entry_date
                        )}
                      </td>

                      <td style={{ padding: 10, color: "#e5e7eb", width: 180 }}>
                        {isEditing ? (
                          <select value={editCategory} onChange={(e) => setEditCategory(e.target.value as any)} style={tableInput}>
                            <option value="fuel">Fuel</option>
                            <option value="insurance">Insurance</option>
                            <option value="hangar_tiedown">Hangar/Tiedown</option>
                            <option value="misc">Misc</option>
                          </select>
                        ) : (
                          r.category.replace("_", "/")
                        )}
                      </td>

                      <td style={{ padding: 10, color: "#e5e7eb", width: 140 }}>
                        {isEditing ? (
                          <input value={editAmount} onChange={(e) => setEditAmount(e.target.value)} style={tableInput} />
                        ) : (
                          money(r.amount)
                        )}
                      </td>

                      <td style={{ padding: 10, color: isEditing ? "#e5e7eb" : "#9ca3af" }}>
                        {isEditing ? (
                          <input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="optional" style={tableInput} />
                        ) : (
                          r.note ?? "—"
                        )}
                      </td>

                      <td style={{ padding: 10, width: 120 }}>
                        {!canEdit ? (
                          <span style={{ opacity: 0.6 }}>—</span>
                        ) : isEditing ? (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button style={btn} disabled={saving} onClick={() => saveEdit(r.id)} type="button">
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button style={btn} disabled={saving} onClick={cancelEdit} type="button">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={menuWrap} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              style={iconBtn}
                              onClick={() => setMenuId((cur) => (cur === r.id ? null : r.id))}
                              disabled={saving}
                              aria-label="Row actions"
                            >
                              ⋮
                            </button>

                            {menuId === r.id && (
                              <div style={menuPanel}>
                                <button type="button" style={menuItem} onClick={() => startEdit(r)}>
                                  Edit
                                </button>
                                <button type="button" style={{ ...menuItem, color: "#fecaca" }} onClick={() => deleteRow(r.id)}>
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}