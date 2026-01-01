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
        setLoading(true);

        // must be logged in to accept
        const { data } = await supabase.auth.getSession();
      if (!data.session) {
  // send them to login, then come right back here
  router.replace(`/login?next=/invite/${token}`);
  return;
}

        const { data: inv, error: invErr } = await supabase
          .from("aircraft_invites")
          .select("*")
          .eq("token", token)
.maybeSingle();

if (!inv) {
  throw new Error("Invite not found or already used.");
}
        if (invErr) throw invErr;
        if (!inv) throw new Error("Invite not found.");

        if (inv.status !== "pending") {
          setError("This invite has already been used or is no longer valid.");
        } else {
          setInvite(inv);
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load invite.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function acceptInvite() {
    setBusy(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not logged in.");

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

      // 3) send them to the aircraft
router.replace(`/aircraft/${invite.aircraft_id}`);
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