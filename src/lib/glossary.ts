/**
 * Plain-English definitions shown behind the info button on each metric.
 * Written for members who are new to investing.
 */
export const GLOSSARY = {
  nav: "Net Asset Value per unit — the price of one unit of the fund. It's the fund's total value divided by the number of units members own. When the investments rise, the NAV rises, and so does the value of every unit.",
  units: "When you invest, your money buys units at that day's NAV. The number of units you own never changes unless you invest or withdraw — what changes is the price of each unit.",
  cashWaiting: "Money that has come into the fund but hasn't been invested in the funds yet. It's safe, but it doesn't grow with the market, so a large cash balance holds the fund's return back until it's put to work.",
  expenseRatio: "The yearly fee a fund charges, as a percentage of what you hold in it. It's taken out automatically, so you never see a bill — it just slightly lowers the fund's return. For index investing, it's one of the few things you fully control.",
  yield: "The income a fund pays out each year from dividends, as a percentage of its price.",
  lookThrough: "Seeing through each fund to what it actually owns. VOO isn't one company — it's about 500. Adding up what's inside every fund shows what the club really owns.",
  concentration: "How much depends on a single company. A fund spreads risk across hundreds or thousands of companies; an individual stock puts it all on one.",
  drawdown: "The largest fall from a high point to a low point. Every investment that grows has them — the question is whether you stay invested through them.",
  volatility: "How much the fund's value typically swings in a year. Higher means a bumpier ride, not necessarily a worse result.",
  benchmark: "A standard to compare against. VT holds the whole world's stock market in one fund, so it's the fair yardstick for a globally diversified portfolio like ours.",
  gainOnContributions: "How much the fund is worth compared with everything members have paid in. This counts every dollar the same no matter when it arrived.",
  navReturn: "How much one unit's price has changed. This is the fund's own investment performance, unaffected by when members added money.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
