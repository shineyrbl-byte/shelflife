"use client";

import { useState } from "react";
import Link from "next/link";

/** Asks for an email and sends a reset link, if this site has email set up. */
export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "noEmail">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await res.json().catch(() => ({}));
    setState(data.emailEnabled === false ? "noEmail" : "sent");
  }

  return (
    <div className="mx-auto w-full max-w-sm px-5 py-16">
      <div className="flex items-center gap-2 font-semibold">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon */}
        <img src="/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
        ShelfLife
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Forgot your password?</h1>
      {state === "sent" ? (
        <p className="mt-4 text-stone-600">
          If <b>{email}</b> has a ShelfLife account, a reset link is on its way. It works for 1 hour. Check your spam folder too.
        </p>
      ) : state === "noEmail" ? (
        <div className="mt-4 space-y-3 text-stone-600">
          <p>This site can&apos;t send emails yet, so here&apos;s how to get back in:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li><b>Staff:</b> ask your shop owner. In Settings → Team, they can send you a reset link.</li>
            <li><b>Shop owners:</b> contact whoever runs this ShelfLife site; they can create a reset link for you.</li>
          </ul>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <p className="text-sm text-stone-500">Enter your login email and we&apos;ll send you a link to set a new password.</p>
          <label className="block text-sm text-stone-600">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <button disabled={state === "busy"} className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {state === "busy" ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-stone-500">
        <Link href="/login" className="text-emerald-700 underline">Back to log in</Link>
      </p>
    </div>
  );
}
