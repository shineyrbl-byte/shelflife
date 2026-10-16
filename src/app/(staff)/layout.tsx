import Link from "next/link";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/stock", label: "Stock" },
  { href: "/bundles", label: "Bundles" },
  { href: "/insights", label: "Insights" },
  { href: "/poster", label: "Poster" },
];

/** Staff pages get the app navigation; the public /deals page doesn't. */
export default function StaffLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b print:hidden border-stone-200 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-5 py-3 text-sm">
          <Link href="/" className="flex items-center gap-2 font-semibold text-stone-900">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon */}
            <img src="/icon-192.png" alt="" className="h-7 w-7 rounded-lg" />
            ShelfLife
          </Link>
          <div className="ml-auto flex items-center gap-5 text-stone-600">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-stone-900">
                {n.label}
              </Link>
            ))}
            <Link href="/deals" target="_blank" className="rounded-lg bg-emerald-600 px-3.5 py-1.5 font-medium text-white hover:bg-emerald-700">
              Customer deals ↗
            </Link>
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </>
  );
}
