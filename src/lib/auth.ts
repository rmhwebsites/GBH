import { NextRequest, NextResponse } from "next/server";
import memberstack from "@memberstack/admin";
import { createServerClient } from "@/lib/supabase";

// Lazy-init Memberstack admin SDK (avoids crashing at import time if key is missing)
let _ms: ReturnType<typeof memberstack.init> | null = null;

function getMs() {
  if (!_ms) {
    const key = process.env.MEMBERSTACK_SECRET_KEY;
    if (!key) {
      throw new Error("MEMBERSTACK_SECRET_KEY is not set");
    }
    _ms = memberstack.init(key);
  }
  return _ms;
}

// Bootstrap admin IDs from env var (always admins — non-removable).
// Admins added via the UI are stored in the `admin_members` Supabase table.
const BOOTSTRAP_ADMIN_IDS = (process.env.NEXT_PUBLIC_ADMIN_MEMBER_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

// Short-lived in-memory cache of DB admin IDs to avoid a Supabase round-trip
// on every authed request. 30s is a good balance for small teams.
const ADMIN_CACHE_TTL_MS = 30_000;
let adminCache: { ids: Set<string>; expiresAt: number } | null = null;

async function getDbAdminIds(): Promise<Set<string>> {
  if (adminCache && adminCache.expiresAt > Date.now()) {
    return adminCache.ids;
  }
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("admin_members")
      .select("memberstack_id");
    if (error) throw error;
    const ids = new Set<string>(
      (data || []).map((r: { memberstack_id: string }) => r.memberstack_id)
    );
    adminCache = { ids, expiresAt: Date.now() + ADMIN_CACHE_TTL_MS };
    return ids;
  } catch (err) {
    console.error("Failed to load admin_members:", err);
    return new Set<string>();
  }
}

export function invalidateAdminCache() {
  adminCache = null;
}

export function isBootstrapAdmin(memberId: string): boolean {
  return BOOTSTRAP_ADMIN_IDS.includes(memberId);
}

export async function isAdminMember(memberId: string): Promise<boolean> {
  if (!memberId) return false;
  if (BOOTSTRAP_ADMIN_IDS.includes(memberId)) return true;
  const ids = await getDbAdminIds();
  return ids.has(memberId);
}

interface AuthResult {
  memberId: string;
  isAdmin: boolean;
}

/**
 * Verify the Memberstack JWT from the request cookie.
 * Returns the member ID and admin status, or null if unauthenticated.
 */
export async function verifyAuth(
  request: NextRequest
): Promise<AuthResult | null> {
  try {
    const token = request.cookies.get("_ms-mid")?.value;
    if (!token) return null;

    const ms = getMs();
    const payload = await ms.verifyToken({ token });
    if (!payload?.id) return null;

    const isAdmin = await isAdminMember(payload.id);

    return {
      memberId: payload.id,
      isAdmin,
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication. Returns 401 if not authenticated.
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthResult | NextResponse> {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return auth;
}

/**
 * Require admin access. Returns 401/403 if not authenticated/authorized.
 */
export async function requireAdmin(
  request: NextRequest
): Promise<AuthResult | NextResponse> {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return auth;
}

/**
 * Check if auth result is an error response.
 */
export function isAuthError(
  result: AuthResult | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
