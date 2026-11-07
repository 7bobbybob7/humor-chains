"use client";

import { useActionState } from "react";
import { createStep, type FormState } from "../actions";

export function AddStepForm({
  chainId,
  nextPosition,
}: {
  chainId: number;
  nextPosition: number;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createStep,
    {},
  );

  return (
    // Remounted on each success so the inputs clear, which is the
    // adjust-during-render alternative to resetting them from an effect.
    <form action={formAction} key={state.success ?? "new"} className="space-y-3">
      <input type="hidden" name="chain_id" value={chainId} />

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-soft">
          Label
        </span>
        <input
          name="label"
          required
          maxLength={80}
          placeholder={`Step ${nextPosition}`}
          className="w-full rounded-lg border-2 border-ink bg-paper-raised px-3 py-2 text-sm font-medium placeholder:text-ink-soft/60 focus:outline-none focus:ring-4 focus:ring-comic-yellow"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-soft">
          Prompt template
        </span>
        <textarea
          name="template"
          required
          rows={5}
          maxLength={4000}
          placeholder={
            nextPosition === 1
              ? "Describe what you see in this image in two plain sentences."
              : "Here is the previous step's output:\n\n{{input}}\n\nWrite {{count}} short, funny captions about it. Return a JSON array of strings and nothing else."
          }
          className="w-full rounded-lg border-2 border-ink bg-paper-raised px-3 py-2 font-mono text-xs leading-relaxed placeholder:text-ink-soft/60 focus:outline-none focus:ring-4 focus:ring-comic-yellow"
        />
      </label>

      {state.error && (
        <p className="panel-sm bg-red-tint px-4 py-2.5 text-sm font-semibold">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="panel-sm bg-green-tint px-4 py-2.5 text-sm font-semibold">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="press panel-sm bg-comic-red px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add step"}
      </button>
    </form>
  );
}
