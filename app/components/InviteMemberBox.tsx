"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Simple random token generator
 */
function makeToken(len = 40) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function InviteMemberBox({
  aircraftId,
  role = "member",
}: {
  aircraftId: string;
  role?: "member" | "owner";
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  async function createInvite() {
    setError(null);
    setInviteLink(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      setError("Enter a valid email.");
      return;
    }

    setBusy(true);

    try {
      // 🔐 Get logged-in user (REQUIRED for RLS)
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw userErr;
      if (!user) throw new Error("Not logged in.");

      const token = makeToken();

      // ✅ Insert invite WITH invited_by
      const { error: insErr } = await supabase
        .from("aircraft_invites")
        .insert([
          {
            aircraft_id: aircraftId,
            invited_email: cleanEmail,
            token,
            role,
            status: "pending",
            invited_by: user.id, // ⭐ FIXES RLS ERROR
          },
        ]);

      if (insErr) throw insErr;

      // 🌐 Build invite link
      const base =
        typeof window !== "undefined" ? window.location.origin : "";

      setInviteLink(`${base}/invite/${token}`);
      setEmail("");
    } catch (e: any) {
      setError(e?.message ?? "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    alert("Invite link copied ✅");
  }

  return (
    <div
      style={{
        marginTop: 16,
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12,
        padding: 14,
        background: "rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 8 }}>
        Invite someone
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="friend@email.com"
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(0,0,0,0.25)",
            color: "white",
            minWidth: 240,
            flex: 1,
          }}
        />

        <button
          onClick={createInvite}
          disabled={busy}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.10)",
            color: "white",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          {busy ? "Creating…" : "Create Invite"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 10, color: "#fecaca" }}>
          Error: {error}
        </div>
      )}

      {inviteLink && (
        <div style={{ marginTop: 10 }}>
          <div style={{ opacity: 0.85, marginBottom: 6 }}>
            Invite link:
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <code
              style={{
                padding: 10,
                borderRadius: 10,
                background: "rgba(0,0,0,0.25)",
                border: "1px solid rgba(255,255,255,0.15)",
                overflowWrap: "anywhere",
                flex: 1,
              }}
            >
              {inviteLink}
            </code>

            <button
              onClick={copyLink}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "transparent",
                color: "white",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}