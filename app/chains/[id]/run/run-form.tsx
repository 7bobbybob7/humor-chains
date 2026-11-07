"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { runChainAction, type RunState } from "../../actions";
import type { ImageRow } from "@/lib/chains";

export function RunForm({
  chainId,
  images,
}: {
  chainId: number;
  images: ImageRow[];
}) {
  const [state, formAction, pending] = useActionState<RunState, FormData>(
    runChainAction,
    {},
  );
  const [imageId, setImageId] = useState<number | null>(null);

  const selected = images.find((i) => i.id === imageId) ?? null;

  return (
    <>
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="chain_id" value={chainId} />
        {imageId !== null && (
          <input type="hidden" name="image_id" value={imageId} />
        )}

        <label className="block text-sm">
          <span className="mb-1.5 block font-display text-base font-bold">
            Topic
          </span>
          <input
            name="topic"
            required
            maxLength={160}
            placeholder="The printer in the library basement"
            className="w-full rounded-xl border-2 border-ink bg-paper-raised px-4 py-3 text-base font-medium placeholder:text-ink-soft/60 focus:outline-none focus:ring-4 focus:ring-comic-yellow"
          />
          <span className="mt-1.5 block text-xs text-ink-soft">
            Reaches step 1 as both{" "}
            <code className="font-mono">{"{{input}}"}</code> and{" "}
            <code className="font-mono">{"{{topic}}"}</code>.
          </span>
        </label>

        {images.length > 0 && (
          <div className="text-sm">
            <span className="mb-1.5 block font-display text-base font-bold">
              Starting image <span className="font-normal text-ink-soft">(optional)</span>
            </span>
            <p className="mb-2.5 text-xs text-ink-soft">
              Passed to step 1 alongside its prompt, so a chain can describe a
              picture before joking about it.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setImageId(null)}
                aria-pressed={imageId === null}
                className={`panel-sm px-3 py-1.5 text-xs font-bold ${
                  imageId === null ? "bg-ink text-paper" : "bg-paper-raised"
                }`}
              >
                No image
              </button>
              {images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setImageId(img.id)}
                  aria-pressed={imageId === img.id}
                  title={img.alt_text ?? img.path}
                  className={`panel-sm overflow-hidden p-0 ${
                    imageId === img.id ? "ring-4 ring-comic-yellow" : ""
                  }`}
                >
                  <Image
                    src={img.public_url}
                    alt={img.alt_text ?? img.path}
                    width={64}
                    height={64}
                    unoptimized
                    className="h-16 w-16 object-cover"
                  />
                </button>
              ))}
            </div>
            {selected && (
              <p className="mt-2 font-mono text-[11px] text-ink-soft">
                using {selected.path}
              </p>
            )}
          </div>
        )}

        {state.error && (
          <p className="panel-sm bg-red-tint px-4 py-3 text-sm font-semibold">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="press panel-sm bg-comic-red px-6 py-3 font-bold text-white disabled:opacity-60"
        >
          {pending ? "Running the chain…" : "Run chain"}
        </button>

        {pending && (
          <p className="text-sm text-ink-soft">
            One model call per step, in sequence. This takes longer than a
            single generation.
          </p>
        )}
      </form>

      {state.result && (
        <div className="mt-8 border-t-2 border-ink pt-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-black">Run output</h2>
            <p className="text-sm text-ink-soft">
              {(state.result.durationMs / 1000).toFixed(1)}s ·{" "}
              {state.result.captions.length} captions saved
              {state.result.requestId && ` · request #${state.result.requestId}`}
            </p>
          </div>

          <ol className="mt-5 space-y-4">
            {state.result.steps.map((s) => (
              <li key={s.stepId} className="panel-sm bg-paper-raised p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-base font-black">
                    {s.position}. {s.label}
                  </p>
                  <p className="font-mono text-[11px] text-ink-soft">
                    {s.model} · {s.latencyMs}ms
                  </p>
                </div>

                <details className="mt-2.5">
                  <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-ink-soft">
                    Prompt sent
                  </summary>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-ink/[0.06] p-3 font-mono text-[11px] leading-relaxed">
                    {s.prompt}
                  </pre>
                </details>

                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
                  Output
                </p>
                <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap rounded-lg bg-ink/[0.06] p-3 font-mono text-[11px] leading-relaxed">
                  {s.output}
                </pre>
              </li>
            ))}
          </ol>

          <h3 className="mt-7 font-display text-lg font-black">
            Captions saved to the feed
          </h3>
          <ul className="mt-3 space-y-2">
            {state.result.captions.map((c, i) => (
              <li
                key={i}
                className="panel-sm bg-yellow-tint px-4 py-2.5 text-sm font-semibold"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
