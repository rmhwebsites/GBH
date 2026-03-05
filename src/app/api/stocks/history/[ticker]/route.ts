import { NextRequest, NextResponse } from "next/server";
import { getHistoricalData } from "@/lib/yahoo";
import { requireAuth, isAuthError } from "@/lib/auth";

type Period = "1d" | "5d" | "1mo" | "3mo" | "1y" | "5y" | "max";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const { ticker } = await params;
    const period =
      (request.nextUrl.searchParams.get("period") as Period) || "1y";

    const validPeriods: Period[] = [
      "1d",
      "5d",
      "1mo",
      "3mo",
      "1y",
      "5y",
      "max",
    ];
    if (!validPeriods.includes(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    const data = await getHistoricalData(ticker.toUpperCase(), period);

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Error fetching historical data:", err);
    return NextResponse.json(
      { error: "Failed to fetch historical data" },
      { status: 500 }
    );
  }
}
