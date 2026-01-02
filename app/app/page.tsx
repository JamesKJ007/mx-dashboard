"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Aircraft = {
  id: string;
  user_id: string;
  tail_number: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  created_at?: string;
  // ✅ add role so UI + permissions can reflect membership
  role: "owner" | "member" | "admin";
};

export default function AppDashboardPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Admin gate
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [tailNumber, setTailNumber] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [saving, setSaving] = useState(false);

  // ---- Auth bootstrap (and live changes)
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      setAuthLoading(true);
      setError(null);

      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        setUserId(null);
        setAuthLoading(false);
        setError(error.message);
        router.replace("/login");
        return;
      }

      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      setAuthLoading(false);

      if (!uid) router.replace("/login");
    }

    initAuth();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      const uid = session?.user?.id ?? null;
      setUserId(uid);

      if (!uid) router.replace("/login");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  // ---- Admin check (runs whenever userId changes)
  useEffect(() => {
    let mounted = true;

    async function checkAdmin() {
      setAdminLoading(true);

      if (!userId) {
        setIsAdmin(false);
        setAdminLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("app_admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("Admin check error:", error.message);
        setIsAdmin(false);
      } else {
        setIsAdmin(!!data);
      }

      setAdminLoading(false);
    }

    checkAdmin();

    return () => {
      mounted = false;
    };
  }, [userId]);

  // ✅ FIX: load aircraft via membership for normal users,
  // and load ALL aircraft for admins
  async function loadAircraft() {
    setLoading(true);
    setError(null);

    if (!userId) {
      setAircraft([]);
      setLoading(false);
      return;
    }

    try {
      if (isAdmin) {
        // Admin sees all aircraft
        const { data, error } = await supabase
          .from("aircraft")
          .select("id, user_id, tail_number, make, model, year, created_at")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const rows =
          (data ?? []).map((a: any) => ({
            ...a,
            role: "admin" as const,
          })) as Aircraft[];

        setAircraft(rows);
      } else {
        // Normal users see aircraft through membership (+ their role)
        const { data, error } = await supabase
          .from("aircraft_members")
          .select(
            "role, aircraft:aircraft_id(id, user_id, tail_number, make, model, year, created_at)"
          )
          .eq("user_id", userId);

        if (error) throw error;

        const rows = (data ?? [])
          .map((r: any) =>
            r.aircraft
              ? ({
                  ...r.aircraft,
                  role: r.role ?? "member",
                } as Aircraft)
              : null
          )
          .filter(Boolean) as Aircraft[];

        // sort newest first (client-side, safe)
        rows.sort((a, b) => {
          const da = a.created_at ? new Date(a.created_at).getTime() : 0;
          const db = b.created_at ? new Date(b.created_at).getTime() : 0;
          return db - da;
        });

        setAircraft(rows);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load aircraft.");
      setAircraft([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (adminLoading) return;
    loadAircraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isAdmin, adminLoading]);

  async function handleLogout() {
    setError(null);
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
    router.replace("/login");
  }

  // ✅ FIX: when creating aircraft, also create membership row for owner
  async function addAircraft(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!userId) {
      setSaving(false);
      setError("You must be logged in to save an aircraft.");
      return;
    }

    const parsedYear =
      year.trim() === ""
        ? null
        : Number.isFinite(Number(year))
        ? Number(year)
        : NaN;

    if (Number.isNaN(parsedYear as any)) {
      setSaving(false);
      setError("Year must be a number (or leave it blank).");
      return;
    }

    try {
      // 1) Create aircraft
      const payload = {
        user_id: userId, // keep legacy owner id
        tail_number: tailNumber.trim() || null,
        make: make.trim() || null,
        model: model.trim() || null,
        year: parsedYear,
      };

      const { data: created, error: insErr } = await supabase
        .from("aircraft")
        .insert([payload])
        .select("id")
        .single();

      if (insErr) throw insErr;

      // 2) Create membership row (owner access)
      const { error: memErr } = await supabase.from("aircraft_members").insert([
        {
          aircraft_id: created.id,
          user_id: userId,
          role: "owner",
        },
      ]);

      if (memErr) throw memErr;

      setTailNumber("");
      setMake("");
      setModel("");
      setYear("");
      setShowForm(false);

      await loadAircraft();
    } catch (e: any) {
      setError(e?.message ?? "Failed to add aircraft");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return <main style={{ padding: 24 }}>Checking login…</main>;
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900 }}>
      <h1 style={{ marginBottom: 8 }}>MX Dashboard ✈️</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={handleLogout} style={{ padding: "8px 12px" }}>
          Logout
        </button>

        {!adminLoading && isAdmin && (
          <button
            onClick={() => router.push("/admin/benchmarks")}
            style={{ padding: "8px 12px" }}
          >
            Admin · Benchmarks
          </button>
        )}
      </div>

      {error && <p style={{ color: "tomato" }}>Error: {error}</p>}

      <button
        onClick={() => setShowForm((s) => !s)}
        style={{ padding: "10px 14px", marginBottom: 16 }}
      >
        {showForm ? "Close" : "+ Add Aircraft"}
      </button>

      {showForm && (
        <form
          onSubmit={addAircraft}
          style={{
            border: "1px solid #333",
            borderRadius: 10,
            padding: 12,
            marginBottom: 16,
            display: "grid",
            gap: 10,
            maxWidth: 700,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <label>Tail Number</label>
            <input
              value={tailNumber}
              onChange={(e) => setTailNumber(e.target.value)}
              placeholder="N123AB"
              style={{ padding: 10, borderRadius: 8, border: "1px solid #444" }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label>Make</label>
            <input
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="Cessna"
              style={{ padding: 10, borderRadius: 8, border: "1px solid #444" }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label>Model</label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="172N"
              style={{ padding: 10, borderRadius: 8, border: "1px solid #444" }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label>Year</label>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="1978"
              style={{ padding: 10, borderRadius: 8, border: "1px solid #444" }}
            />
          </div>

          <button type="submit" disabled={saving} style={{ padding: "10px 14px" }}>
            {saving ? "Saving..." : "Save Aircraft"}
          </button>
        </form>
      )}

      {loading && <p>Loading aircraft…</p>}

      {!loading && aircraft.length === 0 && (
        <p>No aircraft yet. Click “Add Aircraft”.</p>
      )}

      <ul style={{ display: "grid", gap: 10, padding: 0, listStyle: "none" }}>
        {aircraft.map((a) => (
          <li
            key={a.id}
            style={{
              border: "1px solid #333",
              borderRadius: 10,
              padding: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <strong style={{ fontSize: 16 }}>
                  {a.tail_number ?? "Untitled Aircraft"}
                </strong>

                <div style={{ opacity: 0.8, marginTop: 4 }}>
                  {(a.make ?? "") + " " + (a.model ?? "")}{" "}
                  {a.year ? `(${a.year})` : ""}
                </div>

                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                  Role:{" "}
                  <span style={{ textTransform: "uppercase", fontWeight: 700 }}>
                    {a.role}
                  </span>
                </div>
              </div>

              <Link
                href={`/aircraft/${a.id}`}
                style={{
                  alignSelf: "center",
                  padding: "8px 12px",
                  border: "1px solid #444",
                  borderRadius: 10,
                  textDecoration: "none",
                }}
              >
                Open ✈️
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}