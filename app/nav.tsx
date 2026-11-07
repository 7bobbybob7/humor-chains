import Link from "next/link";
import { getAdminProfile } from "@/lib/admin";
import { ThemeToggle } from "./theme-toggle";

export async function Nav() {
  const profile = await getAdminProfile();

  return (
    <header className="border-b-2 border-ink bg-paper">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="font-display text-lg font-black tracking-tight"
          >
            Humor Project
          </Link>
          <span className="pill border-2 border-ink bg-comic-blue px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
            Chains
          </span>
          {/* Only for an admin: /login and /denied must not advertise the
              tool's shape to someone who cannot use it. */}
          {profile?.is_superadmin && (
            <>
              <Link
                href="/"
                className="pill px-3 py-1.5 text-sm font-semibold transition hover:bg-ink/5"
              >
                All chains
              </Link>
              <Link
                href="/chains/new"
                className="pill px-3 py-1.5 text-sm font-semibold transition hover:bg-ink/5"
              >
                New chain
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm">
          {/* Offered signed out too: the theme is a display preference, not
              privileged data, and the login screen should honour it. */}
          <ThemeToggle />
          {profile?.is_superadmin && (
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="pill px-3 py-1.5 text-ink-soft transition hover:bg-ink/5 hover:text-ink"
              >
                Sign out
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
