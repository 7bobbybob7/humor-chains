# Humor Project · Prompt chain tool

Week 8. The third app in the Humor Project: an admin-only tool for building,
reordering and running the prompt chains that write the captions.

It shares one Supabase project with the other two apps, so a chain edited here
is the same row the public app generates from.

- Public rating app — `../humor-project`
- Admin console — `../humor-admin`

## What a chain is

A chain is an ordered list of prompt steps. Each step is its own model call,
and its text output becomes the next step's input. The last step returns the
captions, which are saved to the public feed.

```
image ──▶ 1. describe it ──▶ 2. find what's absurd ──▶ 3. write 5 captions
                  text                  text                  JSON array
```

Templates may use:

| Placeholder | Becomes |
| --- | --- |
| `{{input}}` | the previous step's output — or the topic, in step 1 |
| `{{topic}}` | the topic the run started from |
| `{{count}}` | how many captions the last step should return |

This is deliberately **not** the public app's `lib/pipeline.ts`, which
concatenates every step into a single prompt. A concatenated prompt cannot feed
an image through a describe-then-joke sequence, because there is only ever one
model call.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the three values
npm run dev
```

Run `supabase/week8-chains.sql` in the Supabase SQL editor first, then
`supabase/verify-week8.sql` to check it took.

`.env.local` needs:

| Variable | Where from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page |
| `GEMINI_API_KEY` | Google AI Studio (server-only) |

## Access

Every page and every server action calls `requireSuperadmin()`. `proxy.ts` only
checks that a session exists; the `profiles.is_superadmin` check lives next to
the data, because a server action is its own entry point and can be invoked
without the page ever rendering.

Signed out goes to `/login`. Signed in without admin goes to `/denied` — not
back to `/login`, which would loop.

## Theme

Light, dark and system, as three explicit choices. The chosen value lives in
`localStorage` and is applied to `<html data-theme>` by an inline script in
`app/layout.tsx` before first paint, so there is no flash of the wrong theme on
navigation. "System" removes the attribute and lets
`@media (prefers-color-scheme)` decide.

## Why reordering needs a database function

`prompt_chain_steps` has `unique (chain_id, step_order)`. Postgres checks a
unique constraint as each row is written rather than at the end of the
statement, so giving step 2 the number 1 fails while step 1 still holds it —
even inside one `UPDATE ... CASE`.

So the constraint is `DEFERRABLE` and the swap happens inside
`public.move_chain_step(step_id, direction)`, which defers the check to commit.
Two PostgREST updates could not do this: each is sent as its own transaction.

The function is `SECURITY INVOKER`, so the existing RLS policies still decide
who may write. Its explicit `is_superadmin()` check exists only to turn what
would otherwise be a silent zero-row no-op into an error the interface can
show.

## Layout

```
app/
  page.tsx                      list chains, delete
  chains/actions.ts             every write, each one row-count checked
  chains/new/                   create a chain
  chains/[id]/                  edit chain, step CRUD, reorder
  chains/[id]/run/              run the chain, see every step's output
  chains/[id]/media/            captions this chain produced, and its runs
  theme-toggle.tsx              light / dark / system
lib/
  chain-runner.ts               sequential execution, one model call per step
  chains.ts                     reads
  admin.ts                      the superadmin gate
supabase/
  week8-chains.sql              migration
  verify-week8.sql              rolled-back checks
```
