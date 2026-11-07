"use client";

import { useActionState } from "react";
import { updateChain, type FormState } from "../actions";
import type { Chain } from "@/lib/chains";

export function ChainForm({ chain }: { chain: Chain }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateChain,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={chain.id} />

      <label className="block text-sm">
        <span className="mb-1.5 block font-bold">Name</span>
        <input
          name="name"
          defaultValue={chain.name}
          required
          maxLength={80}
          className="w-full rounded-xl border-2 border-ink bg-paper-raised px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-comic-yellow"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-bold">Description</span>
        <textarea
          name="description"
          defaultValue={chain.description ?? ""}
          rows={2}
          maxLength={400}
          className="w-full rounded-xl border-2 border-ink bg-paper-raised px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-comic-yellow"
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={chain.is_active}
          className="h-4 w-4 accent-comic-blue"
        />
        Active
      </label>

      <p className="font-mono text-[11px] text-ink-soft">
        slug: {chain.slug} · created{" "}
        {new Date(chain.created_at).toLocaleDateString()}
      </p>

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
        className="press panel-sm bg-paper-raised px-5 py-2.5 text-sm font-bold disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save chain"}
      </button>
    </form>
  );
}
