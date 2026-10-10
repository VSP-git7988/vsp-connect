import Link from "next/link";
import { connection } from "next/server";
import { getCompany } from "@/lib/data";
import { company as fallbackCompany } from "@/lib/seed";
import { HomeLink } from "@/components/home-link";
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
      <HomeLink className="header-link">
        Our people <span>↗</span>
      </HomeLink>
    </header>
  );
}
// Rendered by the root layout, so a failed company lookup falls back to the
// seed name rather than taking down every page. connection() renders it per
// request, so a rename shows without a rebuild.
export async function Footer() {
  await connection();
  const company = await getCompany().catch(() => fallbackCompany);
  return (
    <footer>
      <Link href="/" className="footer-brand">
        <Mark small /> {company.name}
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
