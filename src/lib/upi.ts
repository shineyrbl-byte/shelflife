// UPI "intent" links: open any UPI app (GPay, PhonePe, Paytm, BHIM…) with the payee, amount and note
// filled in. Free and standard (NPCI's upi://pay format), but ShelfLife can't see whether a payment
// arrived, so staff check their own UPI app before handing over.

/** A UPI ID (VPA) like "cafemogra@okhdfcbank" or "9876543210@ybl". */
export const UPI_ID_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;

/** The note customers' payments carry, so staff can match a payment to a pickup code. */
export const upiNote = (code: string) => `ShelfLife ${code}`;

export function upiPayUrl(p: { upiId: string; payeeName: string; amount: number; note: string }) {
  const params = new URLSearchParams({
    pa: p.upiId,
    pn: p.payeeName.slice(0, 50),
    am: p.amount.toFixed(2),
    cu: "INR",
    tn: p.note.slice(0, 50),
  });
  // UPI apps expect %20 for spaces, not "+".
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}
