"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** A printable A4 poster for the counter: customers scan the QR code to open today's deals. */
export default function Poster() {
  // Rendered only in the browser (see page.tsx), so the site's own address is available here.
  const [url, setUrl] = useState("");
  const [shopName, setShopName] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((me) => {
        setShopName(me.shop.name);
        setUrl((u) => u || `${window.location.origin}/s/${me.shop.slug}`);
      })
      .catch(() => {});
  }, []);
  const [svg, setSvg] = useState("");

  useEffect(() => {
    if (!url) return;
    QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" }).then(setSvg, () => setSvg(""));
  }, [url]);

  const local = /localhost|127\.0\.0\.1/.test(url);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 print:max-w-none print:p-0">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight">Deals poster</h1>
        <p className="text-sm text-stone-500">Print this and put it by the till. Customers scan it to see today&apos;s rescue bundles.</p>
        <label className="mt-4 block text-xs text-stone-500">
          Link in the QR code
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </label>
        {local && (
          <p className="mt-2 text-sm text-amber-700">
            This is a localhost link, so it only works on this computer. Once ShelfLife is online, put its public address here before printing.
          </p>
        )}
        <button onClick={() => window.print()} className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          Print poster
        </button>
      </div>

      <div className="mt-8 flex aspect-[210/297] flex-col items-center justify-between rounded-2xl border border-stone-200 bg-white p-[8%] text-center print:mt-0 print:h-[273mm] print:rounded-none print:border-0">
        <div>
          <div className="text-[clamp(14px,2.2vw,22px)] font-medium uppercase tracking-widest text-emerald-700 print:text-[22px]">{shopName}</div>
          <h2 className="mt-3 text-[clamp(32px,6vw,64px)] font-bold leading-tight tracking-tight print:text-[64px]">Rescue deals today</h2>
          <p className="mx-auto mt-3 max-w-md text-[clamp(14px,2.2vw,22px)] text-stone-600 print:text-[22px]">
            Fresh food at up to 50% off, so nothing goes to waste.
          </p>
        </div>
        {/* The SVG comes from the qrcode library, not from user content. */}
        <div className="w-[55%] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <div>
          <div className="text-[clamp(18px,3vw,32px)] font-semibold print:text-[32px]">📱 Scan to see what&apos;s on</div>
          <div className="mt-2 break-all text-[clamp(11px,1.5vw,14px)] text-stone-500 print:text-[14px]">{url}</div>
        </div>
      </div>
    </div>
  );
}
