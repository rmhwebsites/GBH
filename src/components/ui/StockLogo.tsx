"use client";

import { useState } from "react";

interface StockLogoProps {
  ticker: string;
  size?: number;
  className?: string;
}

/**
 * Displays a company logo for a stock ticker.
 * Uses Financial Modeling Prep's free image-stock API.
 * Falls back to ticker initials if the logo fails to load.
 */
export function StockLogo({ ticker, size = 36, className = "" }: StockLogoProps) {
  const [hasError, setHasError] = useState(false);
  const logoUrl = `https://financialmodelingprep.com/image-stock/${ticker.toUpperCase()}.png`;
  const initials = ticker.substring(0, 2).toUpperCase();

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-gold/10 text-xs font-bold text-gold ${className}`}
        style={{ width: size, height: size }}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-lg bg-transparent ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={`${ticker} logo`}
        width={size}
        height={size}
        className="h-full w-full object-contain p-1"
        onError={() => setHasError(true)}
        loading="lazy"
      />
    </div>
  );
}
