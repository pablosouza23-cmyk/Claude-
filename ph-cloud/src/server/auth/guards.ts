import "server-only";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "./session";

/** Exige administrador. Para não revelar que a área existe, visitantes comuns recebem 404. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=/admin");
  if (user.role !== "admin") notFound();
  return user;
}
