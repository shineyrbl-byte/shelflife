"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LanguageSwitch, useT, type Key } from "@/lib/i18n";

type Me = { email: string; name: string; role: "owner" | "staff"; shop: { name: string; slug: string; publicUrl: string } };

const NAV: { href: string; label: Key; ownerOnly?: boolean }[] = [
  { href: "/dashboard", label: "nav.dashboard", ownerOnly: true },
  { href: "/stock", label: "nav.stock" },
  { href: "/bundles", label: "nav.bundles" },
  { href: "/insights", label: "nav.insights", ownerOnly: true },
  { href: "/orders", label: "nav.orders", ownerOnly: true },
  { href: "/poster", label: "nav.poster" },
  { href: "/settings", label: "nav.settings", ownerOnly: true },
];

/**
 * Staff navigation. Staff (not owners) only see Stock, Bundles and Poster, and are sent to Stock
 * from owner-only pages. The API enforces the same rules, so this is about a tidy menu, not security.
 */
export default function StaffHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const { t } = useT();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setMe, () => router.replace("/login"));
  }, [router]);

  const isStaff = me?.role === "staff";
  useEffect(() => {
    if (isStaff && NAV.some((n) => n.ownerOnly && pathname.startsWith(n.href))) router.replace("/stock");
  }, [isStaff, pathname, router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/80 backdrop-blur print:hidden">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 text-sm">
        <Link href={isStaff ? "/stock" : "/dashboard"} className="flex items-center gap-2 font-semibold text-stone-900">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon */}
          <img src="/icon-192.png" alt="" className="h-7 w-7 rounded-lg" />
          ShelfLife
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-stone-600">
          {me &&
            NAV.filter((n) => !(isStaff && n.ownerOnly)).map((n) => (
              <Link key={n.href} href={n.href} className={pathname.startsWith(n.href) ? "font-medium text-stone-900" : "hover:text-stone-900"}>
                {t(n.label)}
              </Link>
            ))}
          {me && (
            <>
              <a href={me.shop.publicUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600 px-3.5 py-1.5 font-medium text-white hover:bg-emerald-700">
                {t("nav.customerDeals")}
              </a>
              <div className="flex items-center gap-2 border-l border-stone-200 pl-4">
                <span className="max-w-36 truncate font-medium text-stone-800" title={me.email}>
                  {isStaff && me.name ? `${me.name} · ` : ""}
                  {me.shop.name}
                </span>
                <button onClick={logout} className="text-stone-500 hover:text-stone-900">
                  {t("nav.logout")}
                </button>
                <LanguageSwitch />
              </div>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
