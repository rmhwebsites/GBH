import { NextRequest, NextResponse } from "next/server";
import memberstack from "@memberstack/admin";

const ms = memberstack.init(process.env.MEMBERSTACK_SECRET_KEY || "");

// Server-side admin IDs (not exposed to client)
const ADMIN_IDS = (process.env.NEXT_PUBLIC_ADMIN_MEMBER_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

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

    const payload = await ms.verifyToken({ token });
    if (!payload?.id) return null;

    return {
      memberId: payload.id,
      isAdmin: ADMIN_IDS.includes(payload.id),
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
