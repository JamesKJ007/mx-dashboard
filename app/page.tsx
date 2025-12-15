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
};

export default function Home() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ✅ Admin gate for showing the button
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
      sub.subscription.unsubscribe();
    };
  }, []);

  // ✅ Admin check (runs whenever userId changes)
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
        // Don’t hard-fail the whole dashboard if admin check errors
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

  async function loadAircraft() {
    setLoading(true);
    setError(null);

    if (!userId) {
      setAircraft([]);
      setLoading(false);
      return;
    }

   const { data, error } = await supabase
  .from("aircraft")
  .select("*")
  .eq("user_id", userId)
  .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setAircraft([]);
    } else {
      setAircraft((data as Aircraft[]) ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAircraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleLogout() {
    setError(null);
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
  }

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

    const payload = {
      user_id: userId,
      tail_number: tailNumber.trim() || null,
      make: make.trim() || null,
      model: model.trim() || null,
      year: parsedYear,
    };

    const { error } = await supabase.from("aircraft").insert([payload]);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setTailNumber("");
    setMake("");
    setModel("");
    setYear("");
    setShowForm(false);

    await loadAircraft();
    setSaving(false);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900 }}>
      <h1 style={{ marginBottom: 8 }}>MX Dashboard ✈️</h1>

      {/* Auth Status */}
      <div style={{ marginBottom: 16, opacity: 0.95 }}>
        {authLoading ? (
          <div>Checking login…</div>
        ) : userId ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>Logged in ✅</span>

            <button onClick={handleLogout} style={{ padding: "6px 10px" }}>
              Logout
            </button>

            {/* ✅ Admin-only button */}
            {!adminLoading && isAdmin && (
              <button
                onClick={() => router.push("/admin/benchmarks")}
                style={{
                  padding: "6px 10px",
                  border: "1px solid #444",
                  borderRadius: 10,
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                Admin · Benchmarks
              </button>
            )}
          </div>
        ) : (
          <PasswordLoginBox onError={setError} />
        )}
      </div>

      {error && <p style={{ color: "tomato" }}>Error: {error}</p>}

      {/* Only show app features when logged in */}
      {!userId ? (
        <div style={{ opacity: 0.8 }}>
          Log in to view and manage aircraft.
        </div>
      ) : (
        <>
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
                  placeholder="1975"
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
        </>
      )}
    </main>
  );
}

function PasswordLoginBox({ onError }: { onError: (msg: string | null) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    onError(null);
    setBusy(true);

    try {
      if (!email.includes("@")) {
        onError("Enter a valid email.");
        return;
      }
      if (password.length < 6) {
        onError("Password must be at least 6 characters.");
        return;
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Account created ✅ If you’re asked to confirm email, check your inbox.");
      }
    } catch (e: any) {
      onError(e?.message ?? "Auth error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
      <div style={{ fontWeight: 700 }}>
        {mode === "login" ? "Login 🔐" : "Create account ✨"}
      </div>

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        style={{ padding: 10, borderRadius: 8, border: "1px solid #444" }}
      />

      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="password"
        type="password"
        style={{ padding: 10, borderRadius: 8, border: "1px solid #444" }}
      />

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={handleSubmit} disabled={busy} style={{ padding: "10px 14px" }}>
          {busy ? "Working…" : mode === "login" ? "Login" : "Sign Up"}
        </button>

        <button
          onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          disabled={busy}
          style={{ padding: "10px 14px" }}
        >
          Switch to {mode === "login" ? "Sign Up" : "Login"}
        </button>
      </div>
    </div>
  );
}