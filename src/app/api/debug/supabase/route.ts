import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin, isAuthError } from "@/lib/auth";

/**
 * TEMPORARY DIAGNOSTIC — remove once the schema-cache issue is resolved.
 *
 * Reports which Supabase project this deployment actually talks to, so a
 * URL/key mismatch between environments is visible. Deliberately reports
 * only project refs and JWT role claims (both non-secret identifiers that
 * already appear in the public Supabase URL) — never key material.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const urlRef = url.replace(/^https?:\/\//, "").split(".")[0] || "(unset)";

  // A Supabase service key is a JWT; its payload carries the project ref
  // and role. Decoding the payload reveals no secret (the signature does).
  let keyRef = "(unparseable)";
  let keyRole = "(unparseable)";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  try {
    const payload = JSON.parse(
      Buffer.from(serviceKey.split(".")[1], "base64").toString()
    );
    keyRef = payload.ref || "(no ref claim)";
    keyRole = payload.role || "(no role claim)";
  } catch {
    // Newer publishable/secret keys aren't JWTs — fall through
    keyRef = serviceKey ? "(non-JWT key format)" : "(unset)";
  }

  const supabase = createServerClient();
  const probes: Record<string, string> = {};
  for (const table of [
    "member_investments",
    "voting_config",
    "meetings",
    "investment_windows",
    "investment_submissions",
  ]) {
    const { error } = await supabase
      .from(table)
      .select("*", { head: true, count: "exact" });
    probes[table] = error ? `ERROR: ${error.message}` : "ok";
  }

  return NextResponse.json({
    urlProjectRef: urlRef,
    keyProjectRef: keyRef,
    keyRole,
    refsMatch: urlRef === keyRef,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "(unset)",
    vercelEnv: process.env.VERCEL_ENV || "(local)",
    tables: probes,
  });
}
