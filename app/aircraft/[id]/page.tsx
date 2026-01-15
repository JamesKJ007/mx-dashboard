"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import MonthlyCostChart from "../../components/MonthlyCostChart";
import CostPerHourTrendChart from "../../components/CostPerHourTrendChart";
import InviteMemberBox from "../../components/InviteMemberBox";
import RentalRevenuePanel from "@/app/components/RentalRevenuePanel";

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

type MemberRow = {
  user_id: string;
  role: "owner" | "member";
  created_at?: string;
  // Optional profile fields if you have a profiles table
  profiles?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

function MembersPanel({
  aircraftId,
  myRole,
}: {
  aircraftId: string;
  myRole: "owner" | "member" | "admin" | null;
}) {
  const canEdit = myRole === "owner" || myRole === "admin";

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  // Modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmBody, setConfirmBody] = useState("");
  const [confirmAction, setConfirmAction] = useState<null | (() => Promise<void>)>(null);

  async function loadMembers() {
    if (!aircraftId) return;
    setErr("");
    setLoadingMembers(true);

    /**
     * If you have a public.profiles table with id = user_id, you can join:
     * .select("user_id, role, created_at, profiles(full_name,email)")
     *
     * If you DON'T have profiles, just use:
     * .select("user_id, role, created_at")
     */
    const { data, error } = await supabase
      .from("aircraft_members")
      .select("user_id, role, created_at, profiles(full_name,email)")
      .eq("aircraft_id", aircraftId)
      .order("role", { ascending: true }) // owner first if you want: sort later below
      .order("created_at", { ascending: true });

    if (error) {
      setErr(error.message);
      setMembers([]);
    } else {
      const rows = (data as any as MemberRow[]) ?? [];
      // Ensure owner appears first
      rows.sort((a, b) => (a.role === "owner" ? -1 : 1) - (b.role === "owner" ? -1 : 1));
      setMembers(rows);
    }

    setLoadingMembers(false);
  }

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraftId]);

  function openConfirm(opts: {
    title: string;
    body: string;
    action: () => Promise<void>;
  }) {
    setConfirmTitle(opts.title);
    setConfirmBody(opts.body);
    setConfirmAction(() => opts.action);
    setConfirmOpen(true);
  }

  async function doMakeOwner(userIdToPromote: string) {
    setErr("");
    setActionLoading(true);

    const { error } = await supabase.rpc("transfer_aircraft_ownership", {
      p_aircraft_id: aircraftId,
      p_new_owner_user_id: userIdToPromote,
    });

    if (error) {
      setErr(error.message);
      setActionLoading(false);
      return;
    }

    // ✅ refresh list
    await loadMembers();

    // OPTIONAL: later, call an edge function to email everyone
    // await supabase.functions.invoke("notify-ownership-transfer", { body: { aircraftId, newOwner: userIdToPromote } });

    setActionLoading(false);
  }

  async function doRemoveMember(userIdToRemove: string) {
    setErr("");
    setActionLoading(true);

    // Guard: don’t allow removing the owner (force transfer first)
    const target = members.find((m) => m.user_id === userIdToRemove);
    if (target?.role === "owner") {
      setErr("You can’t remove the owner. Transfer ownership first.");
      setActionLoading(false);
      return;
    }

    const { error } = await supabase
      .from("aircraft_members")
      .delete()
      .eq("aircraft_id", aircraftId)
      .eq("user_id", userIdToRemove);

    if (error) {
      setErr(error.message);
      setActionLoading(false);
      return;
    }

    await loadMembers();
    setActionLoading(false);
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
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.10)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
  };
  const dangerBtn: React.CSSProperties = { ...btn, color: "#fecaca" };
  const ghostBtn: React.CSSProperties = { ...btn, background: "transparent" };

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={smallMuted}>Aircraft Members</div>
          <div style={{ fontSize: 16, fontWeight: 900 }}>
            {myRole ? `You are: ${myRole}` : "Role: —"}
          </div>
        </div>

        <button style={ghostBtn} onClick={loadMembers} disabled={loadingMembers || actionLoading}>
          {loadingMembers ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {!!err && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "rgba(239, 68, 68, 0.14)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "#fecaca",
          }}
        >
          Error: {err}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {loadingMembers ? (
          <div style={{ opacity: 0.8 }}>Loading members…</div>
        ) : members.length === 0 ? (
          <div style={{ opacity: 0.8 }}>No members yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
                  <th style={{ padding: "8px 10px" }}>User</th>
                  <th style={{ padding: "8px 10px" }}>Role</th>
                  <th style={{ padding: "8px 10px", width: 280 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const name =
                    m.profiles?.full_name ||
                    m.profiles?.email ||
                    `${m.user_id.slice(0, 8)}…`;

                  return (
                    <tr key={m.user_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ fontWeight: 900 }}>{name}</div>
                        <div style={{ opacity: 0.7, fontSize: 12 }}>{m.user_id}</div>
                      </td>

                      <td style={{ padding: "8px 10px", fontWeight: 900 }}>
                        {m.role === "owner" ? "Owner 👑" : "Member"}
                      </td>

                      <td style={{ padding: "8px 10px" }}>
                        {!canEdit ? (
                          <span style={{ opacity: 0.7 }}>View only</span>
                        ) : (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {m.role !== "owner" && (
                              <button
                                style={btn}
                                disabled={actionLoading}
                                onClick={() =>
                                  openConfirm({
                                    title: "Transfer ownership?",
                                    body:
                                      "This will transfer ownership to this member and demote the current owner to a member. This aircraft will still have ONLY ONE owner.",
                                    action: async () => {
                                      setConfirmOpen(false);
                                      await doMakeOwner(m.user_id);
                                    },
                                  })
                                }
                              >
                                Make Owner
                              </button>
                            )}

                            {m.role !== "owner" && (
                              <button
                                style={dangerBtn}
                                disabled={actionLoading}
                                onClick={() =>
                                  openConfirm({
                                    title: "Remove member?",
                                    body:
                                      "This will remove the member from this aircraft. They will lose access immediately.",
                                    action: async () => {
                                      setConfirmOpen(false);
                                      await doRemoveMember(m.user_id);
                                    },
                                  })
                                }
                              >
                                Remove
                              </button>
                            )}

                            {m.role === "owner" && <span style={{ opacity: 0.7 }}>Owner cannot be removed</span>}
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

      {/* Confirmation modal */}
      {confirmOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setConfirmOpen(false)}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              background: "#0b1226",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14,
              padding: 16,
              boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 900 }}>{confirmTitle}</div>
            <div style={{ marginTop: 10, opacity: 0.85, lineHeight: 1.35 }}>
              {confirmBody}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <button style={ghostBtn} onClick={() => setConfirmOpen(false)} disabled={actionLoading}>
                Cancel
              </button>
              <button
                style={btn}
                disabled={actionLoading}
                onClick={async () => {
                  if (!confirmAction) return;
                  await confirmAction();
                }}
              >
                {actionLoading ? "Working…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// READ from the view (timeline/ordering/analytics)
const ENTRIES_READ = "maintenance_entries_timeline";
// WRITE to the real table (insert/update/delete must hit a table, not a view)
const ENTRIES_WRITE = "maintenance_entries";

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

  // ---- Benchmark
  const [benchmark, setBenchmark] = useState<BenchmarkRow | null>(null);

  // ✅ Role (owner/member/admin) for invite permissions + page guard
  const [myRole, setMyRole] = useState<"owner" | "member" | "admin" | null>(
    null
  );
  const [roleLoading, setRoleLoading] = useState(true);

  // ---- Add Form
  const [entryDate, setEntryDate] = useState("");
  const [category, setCategory] = useState("Maintenance");
  const [amount, setAmount] = useState("");
  const [tachHours, setTachHours] = useState("");
  const [notes, setNotes] = useState("");
  const [showAddEntry, setShowAddEntry] = useState(false);

  // ---- Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState("Maintenance");
  const [editAmount, setEditAmount] = useState("");
  const [editTach, setEditTach] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // ---- 3-dot menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

  const iconButton: CSSProperties = {
    width: 38,
    height: 38,
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

  const menuWrap: CSSProperties = {
    position: "relative",
    display: "inline-block",
  };

  const menuPanel: CSSProperties = {
    position: "absolute",
    right: 0,
    top: 42,
    minWidth: 140,
    borderRadius: 12,
    background: "#0b1226",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
    zIndex: 50,
    overflow: "hidden",
  };

  const menuItem: CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    background: "transparent",
    border: "none",
    color: "white",
    textAlign: "left",
    cursor: "pointer",
    fontWeight: 700,
  };

  // ---- Close menu on outside click / Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenuId(null);
    }
    function onClick() {
      setOpenMenuId(null);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, []);

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

  // ---- Protect page (redirect if not logged in)
  useEffect(() => {
    if (authLoading) return;
    if (!userId) router.replace("/login");
  }, [authLoading, userId, router]);

  // ---- Load aircraft + role + entries + benchmark
  async function loadAll() {
    if (!aircraftId) return;
    if (!userId) return;

    setLoading(true);
    setError("");

    try {
      // Aircraft
      const { data: aircraftData, error: aircraftErr } = await supabase
        .from("aircraft")
        .select("id, user_id, tail_number, make, model, year, created_at")
        .eq("id", aircraftId)
        .maybeSingle();

      if (aircraftErr) throw aircraftErr;

      setAircraft(aircraftData ?? null);

      if (!aircraftData) {
        setError("Aircraft not found.");
        setEntries([]);
        setRoleLoading(false);
        return;
      }

      // Role
      setRoleLoading(true);

      const { data: adminRow, error: adminErr } = await supabase
        .from("app_admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (adminErr) throw adminErr;

      if (adminRow) {
        setMyRole("admin");
      } else {
        const { data: memData, error: memErr } = await supabase
          .from("aircraft_members")
          .select("role")
          .eq("aircraft_id", aircraftId)
          .eq("user_id", userId)
          .maybeSingle();

        if (memErr) throw memErr;

        const memRow = (memData as any) as { role: "owner" | "member" } | null;

        setMyRole(memRow?.role ?? null);

        if (!memRow) {
          setError("You don’t have access to this aircraft.");
          setAircraft(null);
          setEntries([]);
          setRoleLoading(false);
          return;
        }
      }

      setRoleLoading(false);

      // Entries (READ view)
      const { data: entryData, error: entryErr } = await supabase
        .from(ENTRIES_READ)
        .select(
          "id, user_id, aircraft_id, entry_date, category, amount, tach_hours, notes, created_at"
        )
        .eq("aircraft_id", aircraftId)
        .order("entry_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (entryErr) throw entryErr;
      setEntries(entryData ?? []);

      // Benchmark
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
      setRoleLoading(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!userId) return;
    if (!aircraftId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraftId, userId, authLoading]);

  // ---- Calculations (all-time)
  const totalSpend = useMemo(
    () =>
      entries.reduce(
        (sum, e) => sum + (typeof e.amount === "number" ? e.amount : 0),
        0
      ),
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

  // ---- Benchmark compare
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

  const benchmarkStatus = useMemo(() => {
    if (!benchmarkCompare) return null;
    const absPct = Math.abs(benchmarkCompare.pct);
    if (absPct <= 10) return { label: "On track", color: "#22c55e" };
    if (absPct <= 25) return { label: "Watch", color: "#f59e0b" };
    return { label: "High", color: "#ef4444" };
  }, [benchmarkCompare]);

  // ---- Add Entry (allows backdated + lower tach)
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

    // ✅ If cost is entered, require tach (keeps cost/hr sane)
    if (amountNum !== null && tachNum === null) {
      setSaving(false);
      return setError("Tach hours are required when entering a cost.");
    }

    // Date is optional, but must be valid if provided
    if (entryDate.trim() !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(entryDate.trim())) {
      setSaving(false);
      return setError("Date must be YYYY-MM-DD (or leave blank).");
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

    const { error: insErr } = await supabase.from(ENTRIES_WRITE).insert(payload);

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

  // ---- Edit helpers
  function startEdit(row: MxEntryRow) {
    setOpenMenuId(null);
    setEditingId(row.id);
    setEditDate(row.entry_date ?? "");
    setEditCategory(
      ALLOWED_CATEGORIES.includes(row.category ?? "")
        ? (row.category as string)
        : "Maintenance"
    );
    setEditAmount(row.amount == null ? "" : String(row.amount));
    setEditTach(row.tach_hours == null ? "" : String(row.tach_hours));
    setEditNotes(row.notes ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDate("");
    setEditCategory("Maintenance");
    setEditAmount("");
    setEditTach("");
    setEditNotes("");
  }

  async function saveEdit(id: string) {
    setError("");
    setSaving(true);

    const amountNum = editAmount.trim() === "" ? null : Number(editAmount);
    const tachNum = editTach.trim() === "" ? null : Number(editTach);

    if (amountNum !== null && Number.isNaN(amountNum)) {
      setSaving(false);
      return setError("Amount must be a number.");
    }
    if (tachNum !== null && Number.isNaN(tachNum)) {
      setSaving(false);
      return setError("Tach Hours must be a number.");
    }
    if (amountNum !== null && tachNum === null) {
      setSaving(false);
      return setError("Tach hours are required when entering a cost.");
    }
    if (editDate.trim() !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(editDate.trim())) {
      setSaving(false);
      return setError("Date must be YYYY-MM-DD (or leave blank).");
    }

    const patch = {
      entry_date: editDate.trim() === "" ? null : editDate.trim(),
      category: ALLOWED_CATEGORIES.includes(editCategory)
        ? editCategory
        : "Maintenance",
      amount: amountNum,
      tach_hours: tachNum,
      notes: editNotes.trim() === "" ? null : editNotes.trim(),
    };

    const { error } = await supabase.from(ENTRIES_WRITE).update(patch).eq("id", id);

    if (error) {
      setSaving(false);
      return setError(error.message);
    }

    await loadAll();
    setSaving(false);
    cancelEdit();
  }

  async function deleteEntry(id: string) {
    setOpenMenuId(null);
    if (!confirm("Delete this entry?")) return;

    setError("");
    setSaving(true);

    const { error } = await supabase.from(ENTRIES_WRITE).delete().eq("id", id);

    if (error) {
      setSaving(false);
      return setError(error.message);
    }

    await loadAll();
    setSaving(false);
    if (editingId === id) cancelEdit();
  }

  // ---- Group entries by YEAR (keeps your existing entry order)
  const entriesByYear = useMemo(() => {
    const withDates = entries.filter((e) => !!e.entry_date);
    const withoutDates = entries.filter((e) => !e.entry_date);

    const groups: { year: string; rows: MxEntryRow[] }[] = [];

    for (const row of withDates) {
      const year = (row.entry_date ?? "").slice(0, 4) || "Unknown";
      const last = groups[groups.length - 1];
      if (!last || last.year !== year) groups.push({ year, rows: [row] });
      else last.rows.push(row);
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
        <button style={ghostButton} onClick={() => router.push("/app")}>
          ← Back to Aircraft
        </button>

        <h1 style={{ margin: 0 }}>Aircraft MX ✈️</h1>

        <div style={{ width: 160 }} />
      </div>

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
            {aircraft.tail_number ?? "Untitled"}
            {aircraft.model ? ` — ${aircraft.model}` : ""}
          </div>
        ) : (
          <div style={{ fontSize: 14, opacity: 0.9 }}>
            Couldn’t find aircraft for id: <code>{String(aircraftId)}</code>
          </div>
        )}
      </div>

   {!roleLoading && (myRole === "owner" || myRole === "admin") && (
  <>
    <InviteMemberBox aircraftId={String(aircraftId)} role="member" />

    <MembersPanel aircraftId={String(aircraftId)} myRole={myRole} />

    <RentalRevenuePanel aircraftId={String(aircraftId)} myRole={myRole} />
  </>
)}

      {/* Summary Cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
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
            {costPerHour != null ? `$${costPerHour.toFixed(2)}` : "—"}
          </div>
        </div>
      </div>

      {/* Benchmark Card */}
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
              {benchmark.annual_cost != null ? ` • $${benchmark.annual_cost.toFixed(0)} / yr` : ""}
            </div>

            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {benchmarkCompare ? (
                <>
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
                        You’re <b>{Math.abs(benchmarkCompare.pct).toFixed(1)}%</b> above the industry estimate (≈ $
                        {benchmarkCompare.diff.toFixed(2)} / hr) 📈
                      </>
                    ) : (
                      <>
                        You’re <b>{Math.abs(benchmarkCompare.pct).toFixed(1)}%</b> below the industry estimate (≈ $
                        {Math.abs(benchmarkCompare.diff).toFixed(2)} / hr) 📉
                      </>
                    )}
                  </span>
                </>
              ) : (
                <span style={{ opacity: 0.85 }}>
                  Add more entries with Amount + Tach (at least 2 different tach values) to compare.
                </span>
              )}
            </div>

            <div style={{ marginTop: 6, ...smallMuted }}>Effective: {benchmark.effective_date}</div>
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

      {/* Entries section */}
      <div style={cardLight}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Entries</h2>

          <button style={buttonStyle} type="button" onClick={() => setShowAddEntry((v) => !v)}>
            {showAddEntry ? "Close" : "+ Add Entry"}
          </button>
        </div>

        {showAddEntry && (
          <div style={{ ...cardDark, marginBottom: 14 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Add Maintenance Entry</h3>

            <form onSubmit={addEntry}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={smallMuted}>Date (optional)</span>
                  <input style={inputStyle} type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
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
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 245.00"
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={smallMuted}>Tach Hours</span>
                  <input
                    style={inputStyle}
                    inputMode="decimal"
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
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
                  <th style={{ padding: "8px 10px" }}>Date</th>
                  <th style={{ padding: "8px 10px" }}>Category</th>
                  <th style={{ padding: "8px 10px" }}>Amount</th>
                  <th style={{ padding: "8px 10px" }}>Tach</th>
                  <th style={{ padding: "8px 10px" }}>Notes</th>
                  <th style={{ padding: "8px 10px", width: 90 }}> </th>
                </tr>
              </thead>

              <tbody>
                {entriesByYear.map((group, idx) => (
                  <Fragment key={group.year}>
                    {idx !== 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0, height: 12 }} />
                      </tr>
                    )}

                    <tr>
                      <td
                        colSpan={6}
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

                    {group.rows.map((r) => {
                      const isEditing = editingId === r.id;

                      return (
                        <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          <td style={{ padding: "8px 10px", width: 160 }}>
                            {isEditing ? (
                              <input
                                style={{ ...inputStyle, width: "100%" }}
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                              />
                            ) : (
                              r.entry_date ?? "-"
                            )}
                          </td>

                          <td style={{ padding: "8px 10px", width: 160 }}>
                            {isEditing ? (
                              <select
                                style={{ ...inputStyle, width: "100%" }}
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                              >
                                {ALLOWED_CATEGORIES.map((c) => (
                                  <option key={c} value={c} style={{ color: "black" }}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              r.category ?? "-"
                            )}
                          </td>

                          <td style={{ padding: "8px 10px", width: 140 }}>
                            {isEditing ? (
                              <input
                                style={{ ...inputStyle, width: "100%" }}
                                inputMode="decimal"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                placeholder="245.00"
                              />
                            ) : typeof r.amount === "number" ? (
                              `$${r.amount.toFixed(2)}`
                            ) : (
                              "-"
                            )}
                          </td>

                          <td style={{ padding: "8px 10px", width: 120 }}>
                            {isEditing ? (
                              <input
                                style={{ ...inputStyle, width: "100%" }}
                                inputMode="decimal"
                                value={editTach}
                                onChange={(e) => setEditTach(e.target.value)}
                                placeholder="1834.6"
                              />
                            ) : typeof r.tach_hours === "number" ? (
                              r.tach_hours
                            ) : (
                              "-"
                            )}
                          </td>

                          <td style={{ padding: "8px 10px" }}>
                            {isEditing ? (
                              <input
                                style={{ ...inputStyle, width: "100%" }}
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="Notes"
                              />
                            ) : (
                              r.notes ?? "-"
                            )}
                          </td>

                          <td style={{ padding: "8px 10px" }}>
                            {!isEditing ? (
                              <div style={menuWrap} onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  style={iconButton}
                                  aria-label="Row actions"
                                  onClick={() => setOpenMenuId((cur) => (cur === r.id ? null : r.id))}
                                  disabled={saving}
                                >
                                  ⋮
                                </button>

                                {openMenuId === r.id && (
                                  <div style={menuPanel}>
                                    <button type="button" style={menuItem} onClick={() => startEdit(r)}>
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      style={{ ...menuItem, color: "#fecaca" }}
                                      onClick={() => deleteEntry(r.id)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: 8 }}>
                                <button type="button" style={buttonStyle} disabled={saving} onClick={() => saveEdit(r.id)}>
                                  Save
                                </button>
                                <button type="button" style={ghostButton} disabled={saving} onClick={cancelEdit}>
                                  Cancel
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 10, ...smallMuted }}>
          ✅ Edits/deletes work because writes go to <code>{ENTRIES_WRITE}</code> (not the view).
        </div>
      </div>
    </div>
  );
}