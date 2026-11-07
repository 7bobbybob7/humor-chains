import Link from "next/link";
import { requireSuperadmin } from "@/lib/admin";
import { listChains } from "@/lib/chains";
import { Banner, one } from "./banner";
import { DeleteChain } from "./chains/delete-chain";

export const dynamic = "force-dynamic";

export default async function ChainsPage({ searchParams }: PageProps<"/">) {
  await requireSuperadmin();
  const params = await searchParams;
  const chains = await listChains();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:py-12">
      <Banner failed={one(params.failed)} deleted={one(params.deleted)} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-black sm:text-4xl">
            Prompt chains
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-soft">
            A chain is a sequence of prompts. Each step&apos;s output becomes the
            next step&apos;s input, and the last step returns the captions.
          </p>
        </div>
        <Link
          href="/chains/new"
          className="press panel-sm bg-comic-red px-5 py-2.5 font-bold text-white"
        >
          New chain
        </Link>
      </div>

      {chains.length === 0 ? (
        <div className="panel mt-8 p-7 text-center">
          <p className="font-display text-2xl font-black">No chains yet</p>
          <p className="mt-2 text-sm text-ink-soft">
            Create one, add a few steps, then run it.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {chains.map((c) => (
            <li key={c.id} className="panel panel-hover flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/chains/${c.id}`}
                  className="font-display text-xl font-black underline-offset-4 hover:underline"
                >
                  {c.name}
                </Link>
                {!c.is_active && (
                  <span className="pill shrink-0 border-2 border-ink bg-yellow-tint px-2 py-0.5 text-[10px] font-black uppercase">
                    Inactive
                  </span>
                )}
              </div>

              <p className="mt-1 font-mono text-[11px] text-ink-soft">{c.slug}</p>

              {c.description && (
                <p className="mt-2 line-clamp-3 text-sm text-ink-soft">
                  {c.description}
                </p>
              )}

              <p className="mt-3 text-sm font-semibold">
                {c.stepCount} {c.stepCount === 1 ? "step" : "steps"}
                {c.stepCount !== c.activeStepCount && (
                  <span className="font-normal text-ink-soft">
                    {" "}
                    · {c.activeStepCount} active
                  </span>
                )}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
                <Link
                  href={`/chains/${c.id}`}
                  className="press panel-sm bg-paper-raised px-3 py-1.5 text-sm font-bold"
                >
                  Edit steps
                </Link>
                <Link
                  href={`/chains/${c.id}/run`}
                  className="press panel-sm bg-comic-yellow px-3 py-1.5 text-sm font-bold text-ink-fixed"
                >
                  Run
                </Link>
                <Link
                  href={`/chains/${c.id}/media`}
                  className="press panel-sm bg-paper-raised px-3 py-1.5 text-sm font-bold"
                >
                  Media
                </Link>
                <div className="ml-auto">
                  <DeleteChain id={c.id} name={c.name} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
