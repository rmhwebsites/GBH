export function GBHIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
    >
      {/* Left arrowhead */}
      <polygon points="5,33 33,3 50,42" />
      {/* Right arrowhead */}
      <polygon points="95,33 67,3 50,42" />
      {/* Crossing line: upper-left to lower-right */}
      <line x1="44" y1="46" x2="62" y2="83" />
      {/* Crossing line: upper-right to lower-left */}
      <line x1="56" y1="46" x2="38" y2="83" />
      {/* Bottom triangle */}
      <polygon points="38,83 62,83 50,115" />
    </svg>
  );
}
