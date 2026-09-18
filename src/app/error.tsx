"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="state-page">
      <h1>We couldn’t load this connection.</h1>
      <p>Please try again in a moment.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
