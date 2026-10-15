"use client";

/** fetch wrapper for the app's JSON API: throws the server's error message on failure. */
export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}
