"use client";

import { MemberstackProvider as MSProvider } from "@memberstack/react";
import { MEMBERSTACK_CONFIG } from "@/lib/memberstack";

export function MemberstackProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MSProvider config={{ publicKey: MEMBERSTACK_CONFIG.publicKey }}>
      {children}
    </MSProvider>
  );
}
