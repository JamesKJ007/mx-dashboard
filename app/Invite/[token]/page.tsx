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
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        setInvite(null);
        setLoading(true);

        // Must be logged in to accept — preserve token via ?next=
   const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData.session) {
  router.replace(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  return;
}

        const { data: inv, error: invErr } = await supabase
          .from("aircraft_invites")
          .select("*")
          .eq("token", token)
          .maybeSingle();

        // Always handle Supabase error first
        if (invErr) throw invErr;

        if (!inv) {
          setError("Invite not found or already used.");
          return;
        }

        if (inv.status !== "pending") {
          setError("This invite has already been used or is no longer valid.");
          return;
        }

        setInvite(inv);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load invite.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, router]);

  async function acceptInvite() {
    setBusy(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw userErr;
      if (!user) throw new Error("Not logged in.");

      if (!invite) throw new Error("Invite not loaded.");

      // 1) add to aircraft_members
      const { error: memErr } = await supabase.from("aircraft_members").insert([
        {
          aircraft_id: invite.aircraft_id,
          user_id: user.id,
          role: invite.role,
        },
      ]);

      if (memErr) throw memErr;

      // 2) mark invite accepted
      const { error: updErr } = await supabase
        .from("aircraft_invites")
        .update({
          status: "accepted",
          accepted_by: user.id,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", invite.id);

      if (updErr) throw updErr;

      // 3) send them to the aircraft (THIS must match your app route)
      router.replace(`/app/aircraft/${invite.aircraft_id}`);
    } catch (e: any) {
      setError(e?.message ?? "Accept failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 700 }}>
      <h1>Accept Invite ✈️</h1>

      {loading && <p>Loading invite…</p>}

      {!loading && error && (
        <div style={{ color: "tomato" }}>
          <p>{error}</p>
          <p>
            <Link href="/login">Go to login</Link>
          </p>
        </div>
      )}

      {!loading && invite && !error && (
        <div style={{ marginTop: 16 }}>
          <p style={{ opacity: 0.85 }}>
            You’ve been invited to join an aircraft as <b>{invite.role}</b>.
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