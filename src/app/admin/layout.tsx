import Link from "next/link";
import { adminSections, requireAdmin } from "@/lib/admin";
import { logout } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin)
    return (
      <main id="main" className="state-page">
        <h1>Access restricted</h1>
        <p>Your account does not have administrator access.</p>
        <form action={logout}>
          <button className="button secondary">Sign out</button>
        </form>
      </main>
    );
  return (
    <main id="main" className="dashboard">
      <div className="section-heading">
        <div>
          <div className="eyebrow">VSP CONNECT · TEAM ACCESS</div>
          <h1>Every connection counts.</h1>
        </div>
        <form action={logout}>
          <button className="button secondary">Sign out</button>
        </form>
      </div>
      <nav className="admin-nav" aria-label="Administration sections">
        {adminSections.map(([href, label]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </main>
  );
}
