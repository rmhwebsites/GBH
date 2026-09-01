import { NextRequest, NextResponse, after } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { sendTradeAlert } from "@/lib/emails";
import { requireAdmin, isAuthError } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

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
  const auth = await requireAdmin(request);
  if (isAuthError(auth)) return auth;

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
      // Treat tiny residuals as fully sold so the position is excluded from
      // the portfolio / downloadable reports. portfolio_holdings.shares is
      // DECIMAL(15,6), so anything under 1e-6 is noise.
      if (newShares <= 1e-6) {
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

    // Update cash balance: BUY deducts from cash, SELL adds to cash
    const tradeTotal = body.shares * body.price_per_share;
    const { data: cashHolding } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("ticker", "CASH")
      .limit(1)
      .single();

    if (cashHolding) {
      const newCashBalance =
        body.action === "BUY"
          ? cashHolding.shares - tradeTotal
          : cashHolding.shares + tradeTotal;

      await supabase
        .from("portfolio_holdings")
        .update({ shares: Math.max(0, newCashBalance) })
        .eq("id", cashHolding.id);
    }

    // Notify every member. `after` runs this once the response is sent while
    // keeping the function alive — a bare un-awaited promise can be dropped
    // when the serverless instance is frozen, silently losing the emails.
    after(async () => {
      try {
        const { data: memberRows } = await supabase
          .from("member_investments")
          .select("member_email, member_name, memberstack_id");

        if (!memberRows || memberRows.length === 0) {
          console.warn("Trade alert: no members found to notify");
          return;
        }

        // One email per person: dedupe by member, then by address, and drop
        // anyone without a usable one — a single malformed address would
        // otherwise fail the whole batch and nobody would be told.
        const seenMember = new Set<string>();
        const seenEmail = new Set<string>();
        const recipients: { email: string; name: string }[] = [];
        const skipped: string[] = [];

        for (const row of memberRows) {
          if (seenMember.has(row.memberstack_id)) continue;
          seenMember.add(row.memberstack_id);

          const email = (row.member_email || "").trim();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            skipped.push(row.member_name);
            continue;
          }
          const key = email.toLowerCase();
          if (seenEmail.has(key)) continue;
          seenEmail.add(key);

          recipients.push({ email, name: row.member_name });
        }

        if (skipped.length > 0) {
          console.warn(
            `Trade alert: no valid email for ${skipped.join(", ")}`
          );
        }
        if (recipients.length === 0) {
          console.error("Trade alert: no deliverable recipients");
          return;
        }

        await sendTradeAlert(
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
        );
      } catch (emailErr) {
        console.error("Failed to send trade alert email:", emailErr);
      }
    });

    return NextResponse.json({ trade }, { status: 201 });
  } catch (err) {
    console.error("Error recording trade:", err);
    return NextResponse.json(
      { error: "Failed to record trade" },
      { status: 500 }
    );
  }
}
