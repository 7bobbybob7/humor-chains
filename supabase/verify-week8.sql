-- Week 8 verification. Read-only: everything runs inside a transaction that is
-- ROLLED BACK at the end, so no rows are created, changed or deleted.
--
-- Checks ROW COUNTS and actual column values, not just exceptions. Under RLS a
-- forbidden UPDATE affects zero rows and raises nothing, so a harness that
-- only catches exceptions reports that as success.

begin;

create temp table results(
  n int, scenario text, expected text, actual text, verdict text
) on commit drop;
grant all on results to public;

create or replace function pg_temp.run(stmt text) returns text
language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n::text || ' rows';
exception when others then
  return 'ERROR: ' || substr(sqlerrm, 1, 60);
end $$;
grant execute on function pg_temp.run(text) to public;

-- ---------------------------------------------------------------------------
-- A. Structure.
-- ---------------------------------------------------------------------------
do $$
declare v text; i int := 0;
begin
  -- The whole swap depends on this being deferrable.
  select case when condeferrable then 'deferrable' else 'NOT deferrable' end
    into v
    from pg_constraint
   where conname = 'prompt_chain_steps_chain_id_step_order_key';
  i := i + 1;
  insert into results values (i, 'unique(chain_id, step_order) is deferrable',
    'deferrable', coalesce(v, 'missing'),
    case when v = 'deferrable' then 'PASS' else 'FAIL' end);

  select case when prosecdef then 'definer' else 'invoker' end into v
    from pg_proc where proname = 'move_chain_step';
  i := i + 1;
  insert into results values (i, 'move_chain_step runs as invoker (RLS applies)',
    'invoker', coalesce(v, 'missing'),
    case when v = 'invoker' then 'PASS' else 'FAIL' end);

  i := i + 1;
  select count(*)::text into v from information_schema.columns
   where table_schema = 'public' and table_name = 'llm_responses'
     and column_name = 'step_id';
  insert into results values (i, 'llm_responses.step_id exists', '1', v,
    case when v = '1' then 'PASS' else 'FAIL' end);

  i := i + 1;
  select count(*)::text into v from information_schema.columns
   where table_schema = 'public' and table_name = 'generation_requests'
     and column_name = 'image_id';
  insert into results values (i, 'generation_requests.image_id exists', '1', v,
    case when v = '1' then 'PASS' else 'FAIL' end);

  i := i + 1;
  select count(*)::text into v from public.prompt_chain_steps s
    join public.prompt_chains c on c.id = s.chain_id
   where c.slug = 'describe-then-joke';
  insert into results values (i, 'example chain seeded with 3 steps', '3', v,
    case when v = '3' then 'PASS' else 'FAIL' end);
end $$;

-- ---------------------------------------------------------------------------
-- B. Reordering, as a superadmin.
-- ---------------------------------------------------------------------------
do $$
declare
  admin_id uuid;
  cid      bigint;
  a_id     bigint; b_id bigint; c_id bigint;
  orders   text;
  i        int := 5;
begin
  select id into admin_id from public.profiles where is_superadmin limit 1;
  if admin_id is null then
    insert into results values (99, 'superadmin exists to test with',
      'one', 'none', 'SKIPPED');
    return;
  end if;

  -- A throwaway chain, so a real one is never reordered by the harness.
  insert into public.prompt_chains (name, slug, description)
  values ('zz verify', 'zz-verify-week8', 'rolled back') returning id into cid;
  insert into public.prompt_chain_steps (chain_id, step_order, label, template)
  values (cid, 1, 'A', 'a') returning id into a_id;
  insert into public.prompt_chain_steps (chain_id, step_order, label, template)
  values (cid, 2, 'B', 'b') returning id into b_id;
  insert into public.prompt_chain_steps (chain_id, step_order, label, template)
  values (cid, 5, 'C', 'c') returning id into c_id;

  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
    json_build_object('sub', admin_id, 'role', 'authenticated')::text);

  -- Move A down: A and B trade places.
  perform public.move_chain_step(a_id, 1);
  select string_agg(label || '=' || step_order, ',' order by step_order)
    into orders from public.prompt_chain_steps where chain_id = cid;
  i := i + 1;
  insert into results values (i, 'move step 1 down swaps it with step 2',
    'B=1,A=2,C=5', orders, case when orders = 'B=1,A=2,C=5' then 'PASS' else 'FAIL' end);

  -- Back up again: the swap must be reversible.
  perform public.move_chain_step(a_id, -1);
  select string_agg(label || '=' || step_order, ',' order by step_order)
    into orders from public.prompt_chain_steps where chain_id = cid;
  i := i + 1;
  insert into results values (i, 'moving it back up restores the order',
    'A=1,B=2,C=5', orders, case when orders = 'A=1,B=2,C=5' then 'PASS' else 'FAIL' end);

  -- Non-contiguous orders: B's neighbour below is C at 5, not "order 3".
  perform public.move_chain_step(b_id, 1);
  select string_agg(label || '=' || step_order, ',' order by step_order)
    into orders from public.prompt_chain_steps where chain_id = cid;
  i := i + 1;
  insert into results values (i, 'swaps across a gap in step_order',
    'A=1,C=2,B=5', orders, case when orders = 'A=1,C=2,B=5' then 'PASS' else 'FAIL' end);

  -- At the top already: a no-op, not an error.
  perform public.move_chain_step(a_id, -1);
  select string_agg(label || '=' || step_order, ',' order by step_order)
    into orders from public.prompt_chain_steps where chain_id = cid;
  i := i + 1;
  insert into results values (i, 'moving the first step up is a no-op',
    'A=1,C=2,B=5', orders, case when orders = 'A=1,C=2,B=5' then 'PASS' else 'FAIL' end);

  reset role;
exception when others then
  reset role;
  insert into results values (98, 'superadmin reorder block',
    'no exception', substr(sqlerrm, 1, 60), 'FAIL');
end $$;

-- ---------------------------------------------------------------------------
-- C. A signed-in NON-admin must not be able to reorder or edit.
-- ---------------------------------------------------------------------------
do $$
declare
  plain_id uuid;
  step_id  bigint;
  v        text;
  i        int := 10;
begin
  select id into plain_id from public.profiles
   where coalesce(is_superadmin, false) = false limit 1;
  select s.id into step_id from public.prompt_chain_steps s
    join public.prompt_chains c on c.id = s.chain_id
   where c.slug = 'describe-then-joke' order by s.step_order limit 1;

  if plain_id is null or step_id is null then
    insert into results values (97, 'non-admin profile exists to test with',
      'one', 'none', 'SKIPPED');
    return;
  end if;

  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
    json_build_object('sub', plain_id, 'role', 'authenticated')::text);

  i := i + 1;
  v := pg_temp.run(format('select public.move_chain_step(%s, 1)', step_id));
  insert into results values (i, 'non-admin calling move_chain_step is refused',
    'ERROR', left(v, 5), case when v like 'ERROR%' then 'PASS' else 'FAIL (reordered)' end);

  i := i + 1;
  v := pg_temp.run(format(
    'update public.prompt_chain_steps set label = ''hacked'' where id = %s', step_id));
  insert into results values (i, 'non-admin cannot update a step',
    '0 rows', v, case when v = '0 rows' then 'PASS' else 'FAIL (wrote)' end);

  i := i + 1;
  v := pg_temp.run('select 1 from public.prompt_chains limit 1');
  insert into results values (i, 'non-admin can still READ chains',
    '1 rows', v, case when v = '1 rows' then 'PASS' else 'FAIL' end);

  reset role;
exception when others then
  reset role;
  insert into results values (96, 'non-admin block', 'no exception',
    substr(sqlerrm, 1, 60), 'FAIL');
end $$;

-- ---------------------------------------------------------------------------
-- D. Signed out.
-- ---------------------------------------------------------------------------
do $$
declare v text;
begin
  execute 'set local role anon';
  execute 'set local request.jwt.claims = ''{"role":"anon"}''';

  v := pg_temp.run('select 1 from public.prompt_chains limit 1');
  insert into results values (14, 'anon cannot read chains',
    '0 rows', v, case when v = '0 rows' then 'PASS' else 'FAIL (leaked)' end);

  reset role;
exception when others then
  reset role;
  insert into results values (95, 'anon block', 'no exception',
    substr(sqlerrm, 1, 60), 'FAIL');
end $$;

select n, scenario, expected, actual, verdict from results order by n;

select
  count(*) filter (where verdict = 'PASS')  as passed,
  count(*) filter (where verdict like 'FAIL%') as failed,
  count(*) filter (where verdict = 'SKIPPED') as skipped
from results;

rollback;
