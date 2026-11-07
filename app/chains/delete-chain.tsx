"use client";

import { deleteChain } from "./actions";

/**
 * Client-side only for the confirm(): deleting a chain takes its steps with
 * it, which is not something to do on a stray click.
 */
export function DeleteChain({ id, name }: { id: number; name: string }) {
  return (
    <form
      action={deleteChain}
      onSubmit={(e) => {
        if (
          !confirm(
            `Delete the chain "${name}"? Its steps are deleted with it. This cannot be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="pill px-3 py-1.5 text-sm font-semibold text-comic-red transition hover:bg-comic-red/10"
      >
        Delete
      </button>
    </form>
  );
}
