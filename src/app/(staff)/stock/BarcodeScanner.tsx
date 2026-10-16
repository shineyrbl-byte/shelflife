"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

/** Full-screen camera view that reads one barcode and closes. Uses the back camera on phones. */
export default function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const { t } = useT();
  const [error, setError] = useState<"" | "denied" | "failed">("");

  useEffect(() => {
    let stop = () => {};
    let done = false;
    (async () => {
      try {
        // Loaded only when the scanner opens, so the library isn't in every page's bundle.
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video.current!,
          (result) => {
            if (result && !done) {
              done = true;
              controls.stop();
              navigator.vibrate?.(80);
              onCode(result.getText());
            }
          },
        );
        stop = () => controls.stop();
        if (done) stop();
      } catch (err) {
        const name = (err as Error).name;
        setError(name === "NotAllowedError" ? "denied" : "failed");
      }
    })();
    return () => {
      done = true;
      stop();
    };
  }, [onCode]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-5" role="dialog" aria-label="Scan a barcode">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-black">
        <video ref={video} className="aspect-[3/4] w-full object-cover" muted playsInline />
        {/* Aiming guide */}
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-28 -translate-y-1/2 rounded-xl border-2 border-white/80" />
      </div>
      <p className="mt-4 text-center text-sm text-white/80">{error ? t(error === "denied" ? "scanner.denied" : "scanner.failed") : t("scanner.hint")}</p>
      <button onClick={onClose} className="mt-4 rounded-lg bg-white px-5 py-2 text-sm font-medium text-stone-900">
        {t("common.cancel")}
      </button>
    </div>
  );
}
