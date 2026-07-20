import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email } = await request.json();
  const authorizedEmail = process.env.AUTHORIZED_EMAIL;

  const authorized =
    typeof email === "string" &&
    typeof authorizedEmail === "string" &&
    authorizedEmail.trim().length > 0 &&
    email.trim().toLowerCase() === authorizedEmail.trim().toLowerCase();

  return NextResponse.json({ authorized });
}
