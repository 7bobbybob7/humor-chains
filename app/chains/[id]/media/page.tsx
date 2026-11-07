import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/admin";
import { getChain, listChainMedia, listChainRuns } from "@/lib/chains";

export const dynamic = "force-dynamic";

export default async function ChainMediaPage({
  params,
}: PageProps<"/chains/[id]/media">) {
  await requireSuperadmin();

  const { id } = await params;
  const chainId = Number(id);
  if (!Number.isInteger(chainId) || chainId <= 0) notFound();

  const [chain, media, runs] = await Promise.all([
    getChain(chainId),
    listChainMedia(chainId),
    listChainRuns(chainId),
  ]);
  if (!chain) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:py-12">
      <Link
        href={`/chains/${chain.id}`}
        className="text-sm font-semibold text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        ← {chain.name}
      </Link>

      <h1 className="mt-4 font-display text-3xl font-black sm:text-4xl">
        Media from “{chain.name}”
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Every caption this chain produced, with the votes it has collected on
        the public feed.
      </p>

      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-black">Captions</h2>
          <p className="text-sm text-ink-soft">{media.length} total</p>
        </div>

        {media.length === 0 ? (
          <div className="panel mt-4 p-6 text-center">
            <p className="font-display text-lg font-black">Nothing yet</p>
            <p className="mt-1.5 text-sm text-ink-soft">
              Run the chain and its captions appear here.
            </p>
            <Link
              href={`/chains/${chain.id}/run`}
              className="press panel-sm mt-5 inline-block bg-comic-yellow px-4 py-2 text-sm font-bold text-ink-fixed"
            >
              Run chain
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {media.map((m) => (
              <li
                key={m.id}
                className="panel-sm flex items-start gap-4 bg-paper-raised px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{m.caption}</p>
                  <p className="mt-1 font-mono text-[11px] text-ink-soft">
                    {new Date(m.created_at).toLocaleString()}
                    {m.request_id && ` · request #${m.request_id}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-lg font-black">
                    {m.score > 0 ? `+${m.score}` : m.score}
                  </p>
                  <p className="font-mono text-[10px] text-ink-soft">
                    {m.up_votes}↑ {m.down_votes}↓
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-black">Recent runs</h2>
        <p className="mt-1.5 text-sm text-ink-soft">
          Including the ones that failed — a chain is only as reliable as its
          weakest step.
        </p>

        {runs.length === 0 ? (
          <p className="panel-sm mt-4 bg-paper-raised px-4 py-3 text-sm text-ink-soft">
            No runs recorded.
          </p>
        ) : (
          <div className="panel-sm mt-4 divide-y divide-rule overflow-hidden bg-paper-raised">
            {runs.map((r) => (
              <div key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">{r.topic}</p>
                  <span
                    className={`pill px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                      r.status === "succeeded"
                        ? "bg-green-tint"
                        : r.status === "failed"
                          ? "bg-red-tint"
                          : "bg-yellow-tint"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-ink-soft">
                  #{r.id} · {new Date(r.created_at).toLocaleString()} ·{" "}
                  {r.captions_created} captions
                  {r.duration_ms !== null &&
                    ` · ${(r.duration_ms / 1000).toFixed(1)}s`}
                </p>
                {r.error && (
                  <p className="mt-1.5 text-xs font-semibold text-comic-red">
                    {r.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
