"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Me = { email: string; shop: { name: string; slug: string } };

/** Right side of the staff header: the shop's public deals link, its name and log out. */
export default function ShopMenu() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setMe, () => router.replace("/login"));
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (!me) return null;
  return (
    <>
      <a href={`/s/${me.shop.slug}`} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600 px-3.5 py-1.5 font-medium text-white hover:bg-emerald-700">
        Customer deals ↗
      </a>
      <div className="flex items-center gap-2 border-l border-stone-200 pl-4">
        <span className="max-w-32 truncate font-medium text-stone-800" title={me.email}>{me.shop.name}</span>
        <button onClick={logout} className="text-stone-500 hover:text-stone-900">Log out</button>
      </div>
    </>
  );
}
