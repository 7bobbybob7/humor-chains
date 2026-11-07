import Link from "next/link";
import { requireSuperadmin } from "@/lib/admin";
import { NewChainForm } from "./new-chain-form";

export const dynamic = "force-dynamic";

export default async function NewChainPage() {
  await requireSuperadmin();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:py-12">
      <Link
        href="/"
        className="text-sm font-semibold text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        ← All chains
      </Link>

      <h1 className="mt-4 font-display text-3xl font-black">New prompt chain</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Name it now; you add the steps on the next screen.
      </p>

      <div className="panel mt-7 p-6">
        <NewChainForm />
      </div>
    </main>
  );
}
