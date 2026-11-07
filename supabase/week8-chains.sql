-- ===========================================================================
-- Week 8: prompt chain tool.
--
-- The chain tables themselves already exist (week 7). This migration adds only
-- what the chain tool needs on top: safe reordering, and per-step telemetry.
--
-- Safe to run more than once.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Make (chain_id, step_order) deferrable.
--
-- Swapping two steps means giving each the other's number. Postgres checks a
-- unique constraint as each row is written, not at the end of the statement,
-- so the first UPDATE of a swap collides with the row that still holds the
-- target number -- even inside a single transaction, and even in one UPDATE
-- with a CASE. Deferring the check to COMMIT is what makes a swap expressible
-- at all; the constraint is still enforced, just at the end.
--
-- INITIALLY IMMEDIATE keeps the normal behaviour for every other writer: only
-- a transaction that explicitly asks for deferral gets it.
-- ---------------------------------------------------------------------------
alter table public.prompt_chain_steps
  drop constraint if exists prompt_chain_steps_chain_id_step_order_key;

alter table public.prompt_chain_steps
  add constraint prompt_chain_steps_chain_id_step_order_key
  unique (chain_id, step_order) deferrable initially immediate;

-- ---------------------------------------------------------------------------
-- 2. Reordering.
--
-- Swaps a step with its neighbour in the given direction (-1 up, +1 down).
-- "Neighbour" is the nearest step by order rather than order +/- 1, because
-- deleting a step leaves gaps and the numbers need not be contiguous.
--
-- SECURITY INVOKER on purpose: the RLS policies on prompt_chain_steps still
-- apply, so authorisation lives in one place instead of being re-implemented
-- here. The explicit is_superadmin() check only exists to turn what would be a
-- silent zero-row no-op into an error the interface can show -- a lesson from
-- week 7, where several RLS-filtered writes reported success having done
-- nothing at all.
-- ---------------------------------------------------------------------------
create or replace function public.move_chain_step(
  p_step_id   bigint,
  p_direction int
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_chain       bigint;
  v_order       int;
  v_other_id    bigint;
  v_other_order int;
begin
  if p_direction not in (-1, 1) then
    raise exception 'direction must be -1 (up) or 1 (down), got %', p_direction;
  end if;

  if not public.is_superadmin() then
    raise exception 'not authorised to reorder prompt chain steps';
  end if;

  select chain_id, step_order
    into v_chain, v_order
    from public.prompt_chain_steps
   where id = p_step_id;

  if v_chain is null then
    raise exception 'prompt chain step % not found', p_step_id;
  end if;

  if p_direction = -1 then
    select id, step_order into v_other_id, v_other_order
      from public.prompt_chain_steps
     where chain_id = v_chain and step_order < v_order
     order by step_order desc
     limit 1;
  else
    select id, step_order into v_other_id, v_other_order
      from public.prompt_chain_steps
     where chain_id = v_chain and step_order > v_order
     order by step_order asc
     limit 1;
  end if;

  -- Already first or last. Not an error: the button is simply a no-op there.
  if v_other_id is null then
    return;
  end if;

  set constraints all deferred;

  update public.prompt_chain_steps
     set step_order = v_other_order
   where id = p_step_id;

  update public.prompt_chain_steps
     set step_order = v_order
   where id = v_other_id;
end;
$$;

revoke all on function public.move_chain_step(bigint, int) from public;
grant execute on function public.move_chain_step(bigint, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Per-step telemetry.
--
-- A chained run makes one model call per step, so llm_responses needs to say
-- which step each call belongs to. Nullable: the public app's single-call
-- generations have no step.
-- ---------------------------------------------------------------------------
alter table public.llm_responses
  add column if not exists step_id bigint
  references public.prompt_chain_steps(id) on delete set null;

create index if not exists llm_responses_step_idx
  on public.llm_responses (step_id);

-- ---------------------------------------------------------------------------
-- 4. Let a chain run record the image it started from.
-- ---------------------------------------------------------------------------
alter table public.generation_requests
  add column if not exists image_id bigint
  references public.images(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 5. A worked example chain: the one from the assignment brief.
--
--   image -> description -> what is funny about it -> five captions
--
-- Deliberately given NO prompt_chain_mix row. The public app picks the chain
-- it generates with by weight from that table, so a chain absent from it is
-- visible and runnable in this tool without changing a single thing about
-- what the live feed produces.
-- ---------------------------------------------------------------------------
insert into public.prompt_chains (name, slug, description) values
  ('Describe then joke', 'describe-then-joke',
   'Three steps: describe the input, find what is absurd about it, then write captions. Accepts a starting image.')
on conflict (slug) do nothing;

insert into public.prompt_chain_steps (chain_id, step_order, label, template)
select c.id, s.ord, s.label, s.tmpl
  from public.prompt_chains c,
       (values
         (1, 'Describe the input',
          'Describe what you see, plainly and concretely, in two sentences. ' ||
          'If an image is attached, describe the image. Otherwise describe this: {{input}}'),
         (2, 'Find the funny',
          'Here is a description:' || chr(10) || chr(10) || '{{input}}' || chr(10) || chr(10) ||
          'In two sentences, say what is quietly absurd or relatable about it. ' ||
          'Dry and observational, not zany. No jokes yet.'),
         (3, 'Write the captions',
          'Here is an observation:' || chr(10) || chr(10) || '{{input}}' || chr(10) || chr(10) ||
          'Write {{count}} short joke captions built on it, for a humour site run by ' ||
          'and for college students in New York City.' || chr(10) ||
          '- One sentence each, under 140 characters.' || chr(10) ||
          '- Each takes a genuinely different angle.' || chr(10) ||
          '- No emoji, no hashtags, no surrounding quotation marks.' || chr(10) ||
          '- Good-natured. Nothing cruel, sexual, or aimed at a real person.' || chr(10) || chr(10) ||
          'Return a JSON array of strings and nothing else.')
       ) as s(ord, label, tmpl)
 where c.slug = 'describe-then-joke'
on conflict (chain_id, step_order) do nothing;
