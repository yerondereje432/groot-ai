import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client. Used in Server Components and Route
 * Handlers where we need the request's cookie-based session rather than
 * the browser client. Auth screens and the dashboard's initial data load
 * both run through this so RLS policies apply using the real signed-in
 * user, not a service-role bypass.
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // cookies() is read-only in Server Components.
            // Supabase SSR calls set on every getSession to refresh the token.
            // Swallow it – middleware/route handler will persist the refresh.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // see set() above
          }
        },
      },
    }
  );
}
