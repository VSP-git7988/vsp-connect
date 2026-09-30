// CSS-driven entrance: the content is in the server HTML at full opacity once
// the animation ends, so it never depends on JavaScript to become visible.
export function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`reveal ${className}`}>{children}</div>;
}
