"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const nextUrl = useMemo(() => {
    const n = searchParams.get("next");
    if (n && n.startsWith("/")) return n;
    return "/app";
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace(nextUrl);
    })();
  }, [router, nextUrl]);

  return (
    <main style={{ padding: 24, maxWidth: 600 }}>
      <h1>Log In 🔐</h1>

      <p style={{ opacity: 0.8 }}>
        Need access? <Link href="/">Request access</Link>
      </p>

      {error && <p style={{ color: "tomato" }}>{error}</p>}

      <PasswordLoginBox
        onError={setError}
        onSuccess={() => router.replace(nextUrl)}
        nextUrl={nextUrl}
      />
    </main>
  );
}

function PasswordLoginBox({
  onError,
  onSuccess,
  nextUrl,
}: {
  onError: (msg: string | null) => void;
  onSuccess: () => void;
  nextUrl: string;
}) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

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
        onSuccess();
      } else {
        if (!acceptedTerms) {
          onError("You must accept the Terms of Service to continue.");
          return;
        }

        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        alert("Account created ✅ If you’re asked to confirm email, check your inbox.");
        router.replace(nextUrl);
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

      {mode === "signup" && (
        <label style={{ fontSize: 13, opacity: 0.85 }}>
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          I agree to the{" "}
          <a href="/terms" target="_blank" rel="noreferrer">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" target="_blank" rel="noreferrer">
            Privacy Policy
          </a>
        </label>
      )}

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