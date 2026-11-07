"use client";

import { useActionState } from "react";
import { createChain } from "../actions";
import type { FormState } from "../actions";

export function NewChainForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createChain,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      <label className="block text-sm">
        <span className="mb-1.5 block font-display text-base font-bold">
          Name
        </span>
        <input
          name="name"
          required
          maxLength={80}
          placeholder="Describe then joke"
          className="w-full rounded-xl border-2 border-ink bg-paper-raised px-4 py-3 text-base font-medium placeholder:text-ink-soft/60 focus:outline-none focus:ring-4 focus:ring-comic-yellow"
        />
        <span className="mt-1.5 block text-xs text-ink-soft">
          The slug is generated from this and must be unique.
        </span>
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-display text-base font-bold">
          Description
        </span>
        <textarea
          name="description"
          rows={3}
          maxLength={400}
          placeholder="What this chain is for, and when to reach for it."
          className="w-full rounded-xl border-2 border-ink bg-paper-raised px-4 py-3 text-sm font-medium placeholder:text-ink-soft/60 focus:outline-none focus:ring-4 focus:ring-comic-yellow"
        />
      </label>

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
        {pending ? "Creating…" : "Create chain"}
      </button>
    </form>
  );
}
