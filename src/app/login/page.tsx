import { configured } from "@/lib/supabase";
import { login } from "./actions";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main id="main" className="login-main">
      <div className="login-panel">
        <div className="eyebrow">VSP CONNECT · TEAM ACCESS</div>
        <h1>Welcome back.</h1>
        <p>Your connections, in perspective.</p>
        {!configured ? (
          <div className="setup-note">
            <h2>Connect Supabase to continue</h2>
            <p>
              Internal analytics require Supabase Auth and the database
              migration. Follow the setup instructions in README.md.
            </p>
          </div>
        ) : (
          <form action={login}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
            {error && (
              <p role="alert">
                Unable to sign in. Check your credentials and try again.
              </p>
            )}
            <button className="button primary" type="submit">
              Sign in
            </button>
          </form>
        )}
        <small>Private access for authorized VSP team members.</small>
      </div>
    </main>
  );
}
