import { connection } from "next/server";
import { requireOwner } from "@/lib/auth";
import { listOpenInvites, listTeam } from "@/lib/db";

/** Owner: everyone with a login, plus invite links that haven't been used yet. */
export async function GET() {
  await connection();
  const session = await requireOwner();
  if (session instanceof Response) return session;
  const [team, invites] = await Promise.all([listTeam(session.shop.id), listOpenInvites(session.shop.id)]);
  return Response.json({
    me: session.user.id,
    team: team.map(({ id, name, email, role, createdAt }) => ({ id, name, email, role, createdAt })),
    invites,
  });
}
