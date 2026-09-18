import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="state-page">
      <div className="eyebrow">404 · CONNECTION NOT FOUND</div>
      <h1>This profile isn’t available.</h1>
      <p>It may have moved or is no longer public.</p>
      <Link className="button primary" href="/">
        Meet our people
      </Link>
    </main>
  );
}
