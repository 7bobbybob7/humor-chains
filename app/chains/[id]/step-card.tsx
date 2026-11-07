"use client";

import { useActionState } from "react";
import { deleteStep, moveStep, updateStep, type FormState } from "../actions";
import type { Step } from "@/lib/chains";

/**
 * One step: editable in place, with reorder and delete beside it.
 *
 * The move and delete controls are their own forms rather than buttons inside
 * the edit form -- a form cannot be nested, and a submit button inside the
 * edit form would carry the edit fields along with it.
 */
export function StepCard({
  step,
  position,
  isFirst,
  isLast,
}: {
  step: Step;
  position: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateStep,
    {},
  );

  return (
    <div className="panel p-5 pl-14">
      <span
        aria-hidden="true"
        className="panel-sm pill absolute left-0 top-5 flex h-9 w-9 items-center justify-center bg-comic-blue font-display text-sm font-black text-white"
      >
        {position}
      </span>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-black">{step.label}</p>
          <p className="font-mono text-[11px] text-ink-soft">
            step_order {step.step_order}
            {!step.is_active && " · inactive, skipped when running"}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <form action={moveStep}>
            <input type="hidden" name="id" value={step.id} />
            <input type="hidden" name="chain_id" value={step.chain_id} />
            <input type="hidden" name="direction" value="up" />
            <button
              type="submit"
              disabled={isFirst}
              aria-label={`Move "${step.label}" up`}
              title="Move up"
              className="panel-sm px-2.5 py-1 text-sm font-bold disabled:opacity-30"
            >
              ↑
            </button>
          </form>
          <form action={moveStep}>
            <input type="hidden" name="id" value={step.id} />
            <input type="hidden" name="chain_id" value={step.chain_id} />
            <input type="hidden" name="direction" value="down" />
            <button
              type="submit"
              disabled={isLast}
              aria-label={`Move "${step.label}" down`}
              title="Move down"
              className="panel-sm px-2.5 py-1 text-sm font-bold disabled:opacity-30"
            >
              ↓
            </button>
          </form>
          <form
            action={deleteStep}
            onSubmit={(e) => {
              if (!confirm(`Delete step "${step.label}"?`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={step.id} />
            <input type="hidden" name="chain_id" value={step.chain_id} />
            <button
              type="submit"
              aria-label={`Delete "${step.label}"`}
              className="pill px-2.5 py-1 text-sm font-semibold text-comic-red transition hover:bg-comic-red/10"
            >
              Delete
            </button>
          </form>
        </div>
      </div>

      <form action={formAction} className="mt-4 space-y-3">
        <input type="hidden" name="id" value={step.id} />
        <input type="hidden" name="chain_id" value={step.chain_id} />

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-soft">
            Label
          </span>
          <input
            name="label"
            defaultValue={step.label}
            required
            maxLength={80}
            className="w-full rounded-lg border-2 border-ink bg-paper-raised px-3 py-2 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-comic-yellow"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-soft">
            Prompt template
          </span>
          <textarea
            name="template"
            defaultValue={step.template}
            required
            rows={5}
            maxLength={4000}
            className="w-full rounded-lg border-2 border-ink bg-paper-raised px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-4 focus:ring-comic-yellow"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={step.is_active}
              className="h-4 w-4 accent-comic-blue"
            />
            Active
          </label>
          <button
            type="submit"
            disabled={pending}
            className="press panel-sm bg-paper-raised px-4 py-2 text-sm font-bold disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save step"}
          </button>
          {state.error && (
            <span className="text-sm font-semibold text-comic-red">
              {state.error}
            </span>
          )}
          {state.success && (
            <span className="text-sm font-semibold text-comic-green">
              {state.success}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
