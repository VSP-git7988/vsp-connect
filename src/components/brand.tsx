import Link from "next/link";
export function Mark({ small = false }: { small?: boolean }) {
  return (
    <span aria-hidden="true" className={`brand-mark ${small ? "small" : ""}`}>
      <svg viewBox="0 0 40 40" fill="none">
        <path
          d="M6 10L16 30L23 16M17 10L27 30L35 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="square"
        />
      </svg>
    </span>
  );
}
export function Header() {
  return (
    <header className="header">
      <Link href="/" className="brand">
        <Mark />
        <span>
          VSP <b>Connect</b>
          <small>BY VSP INNOVATIONS</small>
        </span>
      </Link>
      <div className="header-note">
        <span className="status-dot" /> Designed for connection
      </div>
      <Link className="header-link" href="/">
        Our people <span>↗</span>
      </Link>
    </header>
  );
}
export function Footer() {
  return (
    <footer>
      <Link href="/" className="footer-brand">
        <Mark small /> VSP Innovations
      </Link>
      <span>Intelligent products. Human connections.</span>
      <span className="footer-links">
        <Link href="/privacy">Privacy</Link>
        <Link href="/admin">
          Team access <span aria-hidden="true">↗</span>
        </Link>
      </span>
    </footer>
  );
}
