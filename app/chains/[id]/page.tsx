import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/admin";
import { getChain, getSteps, looksConcatenated } from "@/lib/chains";
import { Banner, one } from "../../banner";
import { ChainForm } from "./chain-form";
import { StepCard } from "./step-card";
import { AddStepForm } from "./add-step-form";

export const dynamic = "force-dynamic";

export default async function ChainPage({
  params,
  searchParams,
}: PageProps<"/chains/[id]">) {
  await requireSuperadmin();

  const { id } = await params;
  const chainId = Number(id);
  if (!Number.isInteger(chainId) || chainId <= 0) notFound();

  const [chain, steps, sp] = await Promise.all([
    getChain(chainId),
    getSteps(chainId),
    searchParams,
  ]);
  if (!chain) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:py-12">
      <Banner failed={one(sp.failed)} deleted={one(sp.deleted)} />

      <Link
        href="/"
        className="text-sm font-semibold text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        ← All chains
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-black sm:text-4xl">
          {chain.name}
        </h1>
        <div className="flex gap-2">
          <Link
            href={`/chains/${chain.id}/run`}
            className="press panel-sm bg-comic-yellow px-4 py-2 text-sm font-bold text-ink-fixed"
          >
            Run chain
          </Link>
          <Link
            href={`/chains/${chain.id}/media`}
            className="press panel-sm bg-paper-raised px-4 py-2 text-sm font-bold"
          >
            Media
          </Link>
        </div>
      </div>

      {looksConcatenated(steps) && (
        <p className="panel-sm mt-6 bg-yellow-tint px-4 py-3 text-sm">
          <span className="font-bold">Heads up:</span> no step after the first
          refers to{" "}
          <code className="rounded bg-ink/10 px-1 py-0.5 font-mono text-xs">
            {"{{input}}"}
          </code>
          , so nothing is passed along. This chain was written for the public
          app, which joins every step into one prompt. Run step by step it will
          read oddly — add{" "}
          <code className="rounded bg-ink/10 px-1 py-0.5 font-mono text-xs">
            {"{{input}}"}
          </code>{" "}
          to the steps that should build on the one before.
        </p>
      )}

      <section className="panel mt-7 p-6">
        <h2 className="font-display text-lg font-black">Chain details</h2>
        <div className="mt-4">
          <ChainForm chain={chain} />
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-black">Steps</h2>
          <p className="text-sm text-ink-soft">
            {steps.length} {steps.length === 1 ? "step" : "steps"}
          </p>
        </div>
        <p className="mt-1.5 text-sm text-ink-soft">
          Each step runs in order.{" "}
          <code className="rounded bg-ink/10 px-1 py-0.5 font-mono text-xs">
            {"{{input}}"}
          </code>{" "}
          is the previous step&apos;s output — or the topic, in step 1.{" "}
          <code className="rounded bg-ink/10 px-1 py-0.5 font-mono text-xs">
            {"{{topic}}"}
          </code>{" "}
          ,{" "}
          <code className="rounded bg-ink/10 px-1 py-0.5 font-mono text-xs">
            {"{{count}}"}
          </code>
          ,{" "}
          <code className="rounded bg-ink/10 px-1 py-0.5 font-mono text-xs">
            {"{{terms}}"}
          </code>{" "}
          and{" "}
          <code className="rounded bg-ink/10 px-1 py-0.5 font-mono text-xs">
            {"{{examples}}"}
          </code>{" "}
          also work — the last two come from the Terms and Examples tables in
          the admin. The final step should return a JSON array of captions.
        </p>

        {steps.length === 0 ? (
          <div className="panel mt-5 p-6 text-center">
            <p className="font-display text-lg font-black">No steps yet</p>
            <p className="mt-1.5 text-sm text-ink-soft">
              Add the first one below.
            </p>
          </div>
        ) : (
          <ol className="mt-5 space-y-4">
            {steps.map((step, i) => (
              <li key={step.id} className="step-rail relative">
                <StepCard
                  step={step}
                  position={i + 1}
                  isFirst={i === 0}
                  isLast={i === steps.length - 1}
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="panel mt-8 p-6">
        <h2 className="font-display text-lg font-black">Add a step</h2>
        <p className="mt-1 text-sm text-ink-soft">
          It joins the end of the chain; move it with the arrows afterwards.
        </p>
        <div className="mt-4">
          <AddStepForm chainId={chain.id} nextPosition={steps.length + 1} />
        </div>
      </section>
    </main>
  );
}
