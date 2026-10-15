import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ShelfLife: sell it before it expires",
  description: "Expiry tracking and rescue bundles for small cafés and grocers.",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/stock", label: "Stock" },
  { href: "/bundles", label: "Bundles" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
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
              <Link href="/deals" className="rounded-lg bg-emerald-600 px-3.5 py-1.5 font-medium text-white hover:bg-emerald-700">
                Customer deals ↗
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
