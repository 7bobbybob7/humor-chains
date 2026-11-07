import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/admin";
import { GoogleButton } from "./google-button";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");

  const { error } = await searchParams;
  const raw = Array.isArray(error) ? error[0] : error;
  const message = raw ? raw.slice(0, 200) : undefined;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12">
      <div className="panel p-7">
        <p className="text-[11px] font-black uppercase tracking-wide text-ink-soft">
          Humor Project
        </p>
        <h1 className="mt-1 font-display text-3xl font-black">
          Prompt chain tool
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Staff only. Sign in with the Google account that holds admin access.
        </p>

        {message && (
          <p className="panel-sm mt-6 bg-red-tint px-4 py-3 text-sm font-semibold">
            {message}
          </p>
        )}

        <div className="mt-7">
          <GoogleButton />
        </div>
      </div>
    </main>
  );
}
