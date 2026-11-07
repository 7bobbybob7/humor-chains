-- Rewrites two steps of the seeded "Describe then joke" chain.
--
-- Why: the first version of step 1 said "If an image is attached, describe the
-- image. Otherwise describe this: {{input}}". Given a conditional, the model
-- announced which branch it was in -- "since no image is attached, I cannot
-- describe a visual scene" -- and steps 2 and 3 then built on that remark
-- rather than on the topic, so a run about the World Cup produced five
-- captions about AI image generation and none about football.
--
-- Step 1 therefore no longer mentions images at all: an attached image is
-- already in the request and needs no announcing. Step 3 is additionally
-- anchored to {{topic}}, so one step drifting cannot carry the whole chain
-- off-subject.
--
-- Targeted by slug and step_order, so it touches nothing else. Safe to re-run.

update public.prompt_chain_steps s
   set template =
         'Describe the subject below in two plain, concrete sentences, as a ' ||
         'thing in the world. Never comment on this prompt, on the format, ' ||
         'or on anything you were not given.' || chr(10) || chr(10) ||
         'Subject: {{input}}'
  from public.prompt_chains c
 where c.id = s.chain_id
   and c.slug = 'describe-then-joke'
   and s.step_order = 1;

update public.prompt_chain_steps s
   set template =
         'Here is an observation:' || chr(10) || chr(10) || '{{input}}' || chr(10) || chr(10) ||
         'Write {{count}} short joke captions about {{topic}}, using the ' ||
         'observation above as the angle. For a humour site run by and for ' ||
         'college students in New York City.' || chr(10) ||
         '- One sentence each, under 140 characters.' || chr(10) ||
         '- Each takes a genuinely different angle.' || chr(10) ||
         '- No emoji, no hashtags, no surrounding quotation marks.' || chr(10) ||
         '- Good-natured. Nothing cruel, sexual, or aimed at a real person.' || chr(10) || chr(10) ||
         'Return a JSON array of strings and nothing else.'
  from public.prompt_chains c
 where c.id = s.chain_id
   and c.slug = 'describe-then-joke'
   and s.step_order = 3;

-- Confirm both landed.
select s.step_order, s.label, left(s.template, 70) || '…' as template_start
  from public.prompt_chain_steps s
  join public.prompt_chains c on c.id = s.chain_id
 where c.slug = 'describe-then-joke'
 order by s.step_order;
