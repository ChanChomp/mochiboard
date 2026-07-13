import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."
  );
}

const globalForSupabase = globalThis as typeof globalThis & {
  supabase?: SupabaseClient;
};

export const supabase =
  globalForSupabase.supabase ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForSupabase.supabase = supabase;
}

export const getSupabaseClient = () => supabase;

export async function testSupabaseConnection() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    return {
      ok: false,
      message: error.message,
      error,
    };
  }

  return {
    ok: true,
    message: "Supabase client is configured and reachable.",
    session,
  };
}
