import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { sendTradeAlert } from "@/lib/emails";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("trade_history")
      .select("*")
      .order("trade_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trades: data });
  } catch (err) {
    console.error("Error fetching trades:", err);
    return NextResponse.json(
      { error: "Failed to fetch trades" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServerClient();

    // Record the trade
    const tradeInsert: Record<string, unknown> = {
      ticker: body.ticker.toUpperCase(),
      action: body.action,
      shares: body.shares,
      price_per_share: body.price_per_share,
      total_amount: body.shares * body.price_per_share,
      notes: body.notes || null,
    };
    // Allow admin to set a custom trade date
    if (body.trade_date) {
      tradeInsert.trade_date = body.trade_date;
    }

    const { data: trade, error: tradeError } = await supabase
      .from("trade_history")
      .insert(tradeInsert)
      .select()
      .single();

    if (tradeError) {
      return NextResponse.json(
        { error: tradeError.message },
        { status: 500 }
      );
    }

    // Update holding automatically
    const { data: existing } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("ticker", body.ticker.toUpperCase())
      .limit(1)
      .single();

    if (body.action === "BUY") {
      if (existing) {
        // Update existing holding: recalculate average cost basis
        const totalShares = existing.shares + body.shares;
        const totalCost =
          existing.shares * existing.avg_cost_basis +
          body.shares * body.price_per_share;
        const newAvgCost = totalCost / totalShares;

        await supabase
          .from("portfolio_holdings")
          .update({
            shares: totalShares,
            avg_cost_basis: newAvgCost,
            is_active: true,
          })
          .eq("id", existing.id);
      } else {
        // Create new holding
        await supabase.from("portfolio_holdings").insert({
          ticker: body.ticker.toUpperCase(),
          company_name: body.company_name || body.ticker.toUpperCase(),
          shares: body.shares,
          avg_cost_basis: body.price_per_share,
          is_active: true,
        });
      }
    } else if (body.action === "SELL" && existing) {
      const newShares = existing.shares - body.shares;
      if (newShares <= 0) {
        // Sold all shares
        await supabase
          .from("portfolio_holdings")
          .update({ shares: 0, is_active: false })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("portfolio_holdings")
          .update({ shares: newShares })
          .eq("id", existing.id);
      }
    }

    // Send trade alert email to all members (fire-and-forget)
    try {
      const { data: memberRows } = await supabase
        .from("member_investments")
        .select("member_email, member_name, memberstack_id");

      if (memberRows && memberRows.length > 0) {
        // Deduplicate by memberstack_id
        const seen = new Set<string>();
        const recipients: { email: string; name: string }[] = [];
        for (const row of memberRows) {
          if (!seen.has(row.memberstack_id)) {
            seen.add(row.memberstack_id);
            recipients.push({ email: row.member_email, name: row.member_name });
          }
        }

        sendTradeAlert(
          {
            ticker: body.ticker.toUpperCase(),
            companyName: body.company_name || body.ticker.toUpperCase(),
            action: body.action,
            shares: body.shares,
            pricePerShare: body.price_per_share,
            totalAmount: body.shares * body.price_per_share,
            tradeDate:
              body.trade_date || new Date().toISOString().split("T")[0],
            notes: body.notes || undefined,
          },
          recipients
        ).catch((err) => console.error("Trade alert email error:", err));
      }
    } catch (emailErr) {
      console.error("Failed to queue trade alert email:", emailErr);
    }

    return NextResponse.json({ trade }, { status: 201 });
  } catch (err) {
    console.error("Error recording trade:", err);
    return NextResponse.json(
      { error: "Failed to record trade" },
      { status: 500 }
    );
  }
}
