// Memberstack configuration
export const MEMBERSTACK_CONFIG = {
  publicKey: process.env.NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY || "",
};

// Check if a member is an admin
// Uses NEXT_PUBLIC_ prefix so it's available client-side
export function isAdmin(memberId: string): boolean {
  if (!memberId) return false;
  const adminIds = (process.env.NEXT_PUBLIC_ADMIN_MEMBER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return adminIds.includes(memberId);
}
