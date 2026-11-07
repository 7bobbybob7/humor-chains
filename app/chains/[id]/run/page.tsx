import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/admin";
import { getChain, getSteps, listImages, looksConcatenated } from "@/lib/chains";
import { RunForm } from "./run-form";

export const dynamic = "force-dynamic";

// A chain is several model calls in series, so it needs a far larger budget
// than a single generation. The runner stops starting steps at 50s, leaving
// this 10s of headroom to record the outcome and answer.
export const maxDuration = 60;

export default async function RunPage({ params }: PageProps<"/chains/[id]/run">) {
  await requireSuperadmin();

  const { id } = await params;
  const chainId = Number(id);
  if (!Number.isInteger(chainId) || chainId <= 0) notFound();

  const [chain, steps, images] = await Promise.all([
    getChain(chainId),
    getSteps(chainId),
    listImages(),
  ]);
  if (!chain) notFound();

  const active = steps.filter((s) => s.is_active);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:py-12">
      <Link
        href={`/chains/${chain.id}`}
        className="text-sm font-semibold text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        ← {chain.name}
      </Link>

      <h1 className="mt-4 font-display text-3xl font-black sm:text-4xl">
        Run “{chain.name}”
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Each step is its own model call. The output of one becomes the{" "}
        <code className="rounded bg-ink/10 px-1 py-0.5 font-mono text-xs">
          {"{{input}}"}
        </code>{" "}
        of the next, and the captions from the last step are saved to the feed.
      </p>

      {active.length === 0 ? (
        <div className="panel mt-7 p-6 text-center">
          <p className="font-display text-lg font-black">
            This chain has no active steps
          </p>
          <p className="mt-1.5 text-sm text-ink-soft">
            Add one before running it.
          </p>
          <Link
            href={`/chains/${chain.id}`}
            className="press panel-sm mt-5 inline-block bg-paper-raised px-4 py-2 text-sm font-bold"
          >
            Edit steps
          </Link>
        </div>
      ) : (
        <>
          {looksConcatenated(steps) && (
            <p className="panel-sm mt-6 bg-yellow-tint px-4 py-3 text-sm">
              <span className="font-bold">Heads up:</span> this chain&apos;s
              steps never refer to{" "}
              <code className="rounded bg-ink/10 px-1 py-0.5 font-mono text-xs">
                {"{{input}}"}
              </code>
              , so each one starts fresh instead of building on the last. It was
              written for the public app, which joins them into a single prompt.
              Expect the output to read oddly.
            </p>
          )}

          <ol className="panel-sm mt-6 divide-y divide-rule bg-paper-raised">
            {active.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="pill flex h-6 w-6 shrink-0 items-center justify-center bg-ink text-[11px] font-black text-paper">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold">{s.label}</span>
                {i === active.length - 1 && (
                  <span className="ml-auto text-[10px] font-black uppercase tracking-wide text-ink-soft">
                    returns captions
                  </span>
                )}
              </li>
            ))}
          </ol>

          <div className="panel mt-7 p-6">
            <RunForm chainId={chain.id} images={images} />
          </div>
        </>
      )}
    </main>
  );
}
