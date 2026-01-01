"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params?.token || "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setError(null);
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
        return;
      }

      setLoading(false);
    })();
  }, [token, router]);

  async function acceptInvite() {
    setBusy(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc("accept_aircraft_invite", {
        p_token: token,
      });

      if (error) throw error;

      const aircraftId = data as string;
      router.replace(`/aircraft/${aircraftId}`);
    } catch (e: any) {
      setError(e?.message ?? "Accept failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 700 }}>
      <h1>Accept Invite ✈️</h1>

      {loading && <p>Loading…</p>}

      {!loading && error && (
        <div style={{ color: "tomato" }}>
          <p>{error}</p>
          <p><Link href="/login">Go to login</Link></p>
        </div>
      )}

      {!loading && !error && (
        <div style={{ marginTop: 16 }}>
          <p style={{ opacity: 0.85 }}>
            Click below to accept this invite.
          </p>

          <button
            onClick={acceptInvite}
            disabled={busy}
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #444",
            }}
          >
            {busy ? "Accepting…" : "Accept Invite ✅"}
          </button>
        </div>
      )}
    </main>
  );
}