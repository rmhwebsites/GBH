// Memberstack configuration
export const MEMBERSTACK_CONFIG = {
  publicKey: process.env.NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY || "",
};

// Check if a member is an admin
export function isAdmin(memberId: string): boolean {
  const adminIds = (process.env.ADMIN_MEMBER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return adminIds.includes(memberId);
}
