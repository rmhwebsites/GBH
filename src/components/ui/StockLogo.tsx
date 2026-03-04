"use client";

import { useState } from "react";
import { getStockLogoUrl, getTickerInitials } from "@/lib/stock-logos";

interface StockLogoProps {
  ticker: string;
  size?: number;
  className?: string;
}

export function StockLogo({ ticker, size = 36, className = "" }: StockLogoProps) {
  const [hasError, setHasError] = useState(false);
  const logoUrl = getStockLogoUrl(ticker);
  const initials = getTickerInitials(ticker);

  // If no logo URL found or image failed to load, show initials fallback
  if (!logoUrl || hasError) {
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
      className={`flex items-center justify-center overflow-hidden rounded-lg bg-white ${className}`}
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
