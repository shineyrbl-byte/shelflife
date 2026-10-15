import { redirect } from "next/navigation";

// Temporary: the dashboard comes in a later PR.
export default function Home() {
  redirect("/stock");
}
