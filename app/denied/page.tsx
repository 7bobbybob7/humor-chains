import { getAdminProfile, getCurrentUser } from "@/lib/admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Signed in, but not an admin. Distinct from /login: sending these users back
 * to a login screen would loop, because they are already authenticated.
 */
export default async function DeniedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getAdminProfile();
  if (profile?.is_superadmin) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
      <div className="panel p-7 text-center">
        <p className="font-display text-5xl font-black">🔒</p>
        <h1 className="mt-3 font-display text-2xl font-black">
          Not an admin account
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          You&apos;re signed in as{" "}
          <span className="font-semibold text-ink">{user.email}</span>, but that
          account doesn&apos;t have admin access.
        </p>
        <p className="mt-4 text-xs text-ink-soft">
          Access is granted by setting{" "}
          <code className="rounded bg-ink/10 px-1 py-0.5">
            profiles.is_superadmin
          </code>{" "}
          in Supabase.
        </p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button
            type="submit"
            className="press panel-sm bg-paper-raised px-5 py-2.5 font-bold"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
