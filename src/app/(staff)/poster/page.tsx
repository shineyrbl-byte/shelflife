"use client";

import dynamic from "next/dynamic";

// The poster needs the site's own address for the QR code, which only exists in the browser.
const Poster = dynamic(() => import("./Poster"), { ssr: false });

export default function PosterPage() {
  return <Poster />;
}
