import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client (uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client (uses service role key for admin operations)
export function createServerClient() {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * True when an error is PostgREST reporting a stale schema cache — the table
 * exists in Postgres but the API instance's cached schema predates it. This
 * resolves on its own once that instance reloads, so callers should retry
 * rather than surface "table not found" to the user.
 */
export function isStaleSchemaCacheError(error: unknown): boolean {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  return message.includes("schema cache");
}

/**
 * Run a Supabase query, retrying if the API instance serves a stale schema
 * cache. Each attempt builds a fresh client so retries can land on a
 * different instance, and a reload is requested before retrying.
 *
 * Accepts a PromiseLike because Supabase query builders are thenables
 * rather than real Promises.
 */
export async function withSchemaRetry<T extends { error: unknown }>(
  run: (client: ReturnType<typeof createServerClient>) => PromiseLike<T>,
  attempts = 3
): Promise<T> {
  let last: T | undefined;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const result = await run(createServerClient());

    // Supabase reports errors in the payload rather than throwing
    if (!result.error || !isStaleSchemaCacheError(result.error)) {
      return result;
    }
    last = result;

    // Ask PostgREST to rebuild its schema cache, then back off before retrying
    try {
      await createServerClient().rpc("reload_schema_cache");
    } catch {
      // Helper may not exist yet — retrying alone often hits a healthy instance
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }

  return last!;
}
