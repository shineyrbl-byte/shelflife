"use client";

/** fetch wrapper for the app's JSON API: throws the server's error message on failure. */
export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  if (res.status === 401 && !url.startsWith("/api/auth/")) {
    // Session expired or logged out in another tab: back to the login page, then return here.
    // A full reload on purpose, so nothing from the old session stays in memory.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}
