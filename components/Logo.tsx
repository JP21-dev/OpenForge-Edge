export function Logo({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label="OpenForge">
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="#16121f" stroke="#9061f9" strokeWidth="2" />
      <g stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round">
        <path d="M12.5 6.5v2.5M16 6.5v2.5M19.5 6.5v2.5M12.5 23v2.5M16 23v2.5M19.5 23v2.5M6.5 12.5H9M6.5 16H9M6.5 19.5H9M23 12.5h2.5M23 16h2.5M23 19.5h2.5" />
        <rect x="9" y="9" width="14" height="14" rx="2.5" fill="none" />
      </g>
      <path d="M17.2 11.2 13 16.8h2.9l-1.1 4 4.2-5.6h-2.9z" fill="#9061f9" />
    </svg>
  );
}
