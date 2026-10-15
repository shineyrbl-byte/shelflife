import Link from "next/link";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/stock", label: "Stock" },
  { href: "/bundles", label: "Bundles" },
];

/** Staff pages get the app navigation; the public /deals page doesn't. */
export default function StaffLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-5 py-3 text-sm">
          <Link href="/" className="flex items-center gap-2 font-semibold text-stone-900">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-600 text-white">⏳</span>
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
