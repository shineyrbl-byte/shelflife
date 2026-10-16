"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";

type Member = { id: string; name: string; email: string; role: "owner" | "staff"; createdAt: string };
type Invite = { id: string; createdAt: string; expiresAt: string };
type TeamData = { me: string; team: Member[]; invites: Invite[] };

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Owner: who can log in, invite links for new staff, and removing people. */
export default function Team() {
  const [data, setData] = useState<TeamData | null>(null);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => api<TeamData>("/api/team").then(setData, (err) => setError(err.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  async function invite() {
    setError("");
    try {
      const r = await api<{ url: string }>("/api/team/invites", { method: "POST" });
      setLink(r.url);
      setCopied(false);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(m: Member) {
    if (!window.confirm(`Remove ${m.name || m.email}? They'll be logged out right away.`)) return;
    await api(`/api/team/${m.id}`, { method: "DELETE" }).then(load, (err) => setError(err.message));
  }

  const revoke = (i: Invite) => api(`/api/team/invites/${encodeURIComponent(i.id)}`, { method: "DELETE" }).then(load, (err) => setError(err.message));

  if (!data) return null;
  return (
    <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-semibold">Team</h2>
      <p className="text-sm text-stone-500">
        Staff get their own login. They can add stock, sell bundles and hand over reservations, but can&apos;t see money reports, Insights or Settings.
      </p>

      <ul className="mt-4 divide-y divide-stone-100">
        {data.team.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
            <div className="flex-1">
              <div className="font-medium">
                {m.name || m.email}
                {m.id === data.me && <span className="font-normal text-stone-400"> (you)</span>}
              </div>
              <div className="text-xs text-stone-500">
                {m.name ? `${m.email} · ` : ""}
                {m.role === "owner" ? "Owner" : `Staff since ${dateLabel(m.createdAt)}`}
              </div>
            </div>
            {m.role === "staff" && (
              <button onClick={() => remove(m)} className="rounded-lg border border-red-200 px-2.5 py-1 text-red-700 hover:bg-red-50">
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-xl bg-stone-50 p-4">
        <button onClick={invite} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          + Invite a staff member
        </button>
        {link && (
          <div className="mt-3">
            <p className="text-sm text-stone-600">Send this link to them. It works once, for 7 days, and won&apos;t be shown again.</p>
            <div className="mt-2 flex gap-2">
              <input readOnly value={link} className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs" onFocus={(e) => e.target.select()} />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(link);
                  setCopied(true);
                }}
                className="shrink-0 rounded-lg border border-stone-300 bg-white px-3 text-sm"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Join our shop on ShelfLife: ${link}`)}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-medium text-white"
              >
                WhatsApp
              </a>
            </div>
          </div>
        )}
        {data.invites.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-stone-500">
            {data.invites.map((i) => (
              <li key={i.id}>
                Open invite from {dateLabel(i.createdAt)}, valid until {dateLabel(i.expiresAt)} ·{" "}
                <button onClick={() => revoke(i)} className="underline hover:text-stone-800">
                  cancel it
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
