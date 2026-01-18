"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MyRole = "owner" | "admin" | "member" | null;

type SettingsRow = {
  aircraft_id: string;
  show_cost_per_hour_summary: boolean;
  include_maintenance: boolean;
  include_insurance: boolean;
  include_fuel: boolean;
  include_hangar_tiedown: boolean;
  include_misc: boolean;
  updated_at?: string;
};

type OpExpenseRow = {
  id: string;
  aircraft_id: string;
  entry_date: string;
  category: "insurance" | "fuel" | "hangar_tiedown" | "misc";
  amount: number;
};

function money(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

const DEFAULTS: SettingsRow = {
  aircraft_id: "",
  show_cost_per_hour_summary: true,
  include_maintenance: true,
  include_insurance: false,
  include_fuel: false,
  include_hangar_tiedown: false,
  include_misc: false,
};

export default function AllInCostPanel({
  aircraftId,
  myRole,
  maintenanceSpendAllTime,
  hoursFlownAllTime,
}: {
  aircraftId: string;
  myRole: MyRole;
  maintenanceSpendAllTime: number; // from your existing totals
  hoursFlownAllTime: number; // from your existing tach-based model
}) {
  const canEdit = myRole === "owner" || myRole === "admin";

  const [settings, setSettings] = useState<SettingsRow>({ ...DEFAULTS, aircraft_id: aircraftId });
  const [op, setOp] = useState<OpExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      // settings
      const { data: s, error: se } = await supabase
        .from("aircraft_settings")
        .select("aircraft_id, show_cost_per_hour_summary, include_maintenance, include_insurance, include_fuel, include_hangar_tiedown, include_misc, updated_at")
        .eq("aircraft_id", aircraftId)
        .maybeSingle();

      if (se) throw se;

      setSettings((cur) => ({
        ...cur,
        ...(s ?? {}),
        aircraft_id: aircraftId,
      }));

      // operating expenses
      const { data: o, error: oe } = await supabase
        .from("aircraft_operating_expenses")
        .select("id, aircraft_id, entry_date, category, amount")
        .eq("aircraft_id", aircraftId);

      if (oe) throw oe;

      setOp((o ?? []) as OpExpenseRow[]);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load all-in settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!aircraftId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraftId]);

  const opTotals = useMemo(() => {
    const out = { insurance: 0, fuel: 0, hangar_tiedown: 0, misc: 0, total: 0 };
    for (const r of op) {
      const amt = Number(r.amount) || 0;
      out[r.category] += amt;
      out.total += amt;
    }
    return out;
  }, [op]);

  const includedCost = useMemo(() => {
    let sum = 0;
    if (settings.include_maintenance) sum += Number(maintenanceSpendAllTime) || 0;
    if (settings.include_fuel) sum += opTotals.fuel;
    if (settings.include_insurance) sum += opTotals.insurance;
    if (settings.include_hangar_tiedown) sum += opTotals.hangar_tiedown;
    if (settings.include_misc) sum += opTotals.misc;
    return sum;
  }, [settings, maintenanceSpendAllTime, opTotals]);

  const allIn = useMemo(() => {
    const hrs = Number(hoursFlownAllTime) || 0;
    if (hrs <= 0) return null;
    return includedCost / hrs;
  }, [includedCost, hoursFlownAllTime]);

  const includesLabel = useMemo(() => {
    const parts: string[] = [];
    if (settings.include_maintenance) parts.push("Maintenance");
    if (settings.include_fuel) parts.push("Fuel");
    if (settings.include_insurance) parts.push("Insurance");
    if (settings.include_hangar_tiedown) parts.push("Hangar/Tiedown");
    if (settings.include_misc) parts.push("Misc");
    return parts.length ? parts.join(", ") : "None";
  }, [settings]);

  async function saveSettings(patch: Partial<SettingsRow>) {
    if (!canEdit) return;

    setSaving(true);
    setErr(null);

    const next = { ...settings, ...patch, aircraft_id: aircraftId };

    const { error } = await supabase
      .from("aircraft_settings")
      .upsert(next, { onConflict: "aircraft_id" });

    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }

    setSettings(next);
    setSaving(false);
  }

  const card: React.CSSProperties = {
    padding: 14,
    borderRadius: 12,
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 14,
  };

  const smallMuted: React.CSSProperties = { opacity: 0.75, fontSize: 12 };

  const pill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#e5e7eb",
    fontWeight: 900,
    fontSize: 12,
  };

  const toggleRow: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };

  const toggle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    cursor: canEdit ? "pointer" : "default",
    userSelect: "none",
  };

  const checkbox: React.CSSProperties = { width: 18, height: 18 };

  if (loading) {
    return <div style={{ color: "#e5e7eb", opacity: 0.85 }}>Loading all-in cost…</div>;
  }

  if (!settings.show_cost_per_hour_summary) {
    return null;
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#e5e7eb", fontWeight: 900, fontSize: 16 }}>All-in Cost / Hour</div>
          <div style={{ color: "#9ca3af", fontSize: 13 }}>
            Includes: <b style={{ color: "#e5e7eb" }}>{includesLabel}</b>
          </div>
        </div>

        <span style={pill}>
          {allIn == null ? "—" : money(allIn)} <span style={{ opacity: 0.8, fontWeight: 800 }}>/hr</span>
        </span>
      </div>

      {err && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#fecaca", fontWeight: 800 }}>
          {err}
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ ...smallMuted, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }}>
          Selected costs: <b style={{ color: "#e5e7eb" }}>{money(includedCost)}</b>
        </div>
        <div style={{ ...smallMuted, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }}>
          Hours: <b style={{ color: "#e5e7eb" }}>{Number(hoursFlownAllTime || 0).toFixed(1)}</b>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ color: "#9ca3af", fontSize: 12, fontWeight: 900, marginBottom: 8 }}>Settings</div>

        {!canEdit ? (
          <div style={{ color: "#9ca3af", fontWeight: 700 }}>Owner/Admin can change what’s included.</div>
        ) : (
          <>
            <div style={toggleRow}>
              <label style={toggle}>
                <input
                  style={checkbox}
                  type="checkbox"
                  checked={settings.include_maintenance}
                  disabled={saving}
                  onChange={(e) => saveSettings({ include_maintenance: e.target.checked })}
                />
                Maintenance
              </label>

              <label style={toggle}>
                <input
                  style={checkbox}
                  type="checkbox"
                  checked={settings.include_fuel}
                  disabled={saving}
                  onChange={(e) => saveSettings({ include_fuel: e.target.checked })}
                />
                Fuel
              </label>

              <label style={toggle}>
                <input
                  style={checkbox}
                  type="checkbox"
                  checked={settings.include_insurance}
                  disabled={saving}
                  onChange={(e) => saveSettings({ include_insurance: e.target.checked })}
                />
                Insurance
              </label>

              <label style={toggle}>
                <input
                  style={checkbox}
                  type="checkbox"
                  checked={settings.include_hangar_tiedown}
                  disabled={saving}
                  onChange={(e) => saveSettings({ include_hangar_tiedown: e.target.checked })}
                />
                Hangar/Tiedown
              </label>

              <label style={toggle}>
                <input
                  style={checkbox}
                  type="checkbox"
                  checked={settings.include_misc}
                  disabled={saving}
                  onChange={(e) => saveSettings({ include_misc: e.target.checked })}
                />
                Misc
              </label>
            </div>

            <div style={{ marginTop: 10 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  style={checkbox}
                  type="checkbox"
                  checked={settings.show_cost_per_hour_summary}
                  disabled={saving}
                  onChange={(e) => saveSettings({ show_cost_per_hour_summary: e.target.checked })}
                />
                <span style={{ color: "#e5e7eb", fontWeight: 900 }}>Show All-in widget</span>
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}