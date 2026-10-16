"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Old link: sends staff to their shop's public deals page, which now lives at /s/<shop>. */
export default function DealsRedirect() {
  const router = useRouter();
  const [lost, setLost] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((me) => router.replace(`/s/${me.shop.slug}`))
      .catch(() => setLost(true));
  }, [router]);
  return (
    <p className="mx-auto max-w-xl px-5 py-24 text-center text-stone-500">
      {lost ? "Each shop has its own deals page now. Scan the QR code at the counter, or ask the shop for its link." : "Opening deals…"}
    </p>
  );
}
