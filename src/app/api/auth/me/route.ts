import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { memberId: null, isAdmin: false },
      { status: 200 }
    );
  }
  return NextResponse.json({
    memberId: auth.memberId,
    isAdmin: auth.isAdmin,
  });
}
