import { NextResponse } from "next/server";
import { destroyCurrentSession } from "@/server/auth/session";
import { absoluteUrl, isSameOrigin } from "@/server/security/request";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new NextResponse("Origem não permitida.", { status: 403 });
  await destroyCurrentSession();
  return NextResponse.redirect(absoluteUrl(req, "/"), { status: 303 });
}
