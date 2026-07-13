import { NextResponse } from "next/server";

import { testSupabaseConnection } from "@/lib/supabase";

export async function GET() {
  try {
    const result = await testSupabaseConnection();
    return NextResponse.json(result, {
      status: result.ok ? 200 : 500,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected Supabase error.";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      {
        status: 500,
      }
    );
  }
}
