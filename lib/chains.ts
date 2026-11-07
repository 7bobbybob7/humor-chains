import { createClient } from "@/lib/supabase/server";

export type Chain = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type Step = {
  id: number;
  chain_id: number;
  step_order: number;
  label: string;
  template: string;
  is_active: boolean;
  created_at: string;
};

export type ChainSummary = Chain & { stepCount: number; activeStepCount: number };

export type ImageRow = {
  id: number;
  path: string;
  public_url: string;
  alt_text: string | null;
};

export type MediaRow = {
  id: number;
  caption: string;
  score: number;
  up_votes: number;
  down_votes: number;
  created_at: string;
  request_id: number | null;
};

export type RunRow = {
  id: number;
  topic: string;
  status: string;
  error: string | null;
  captions_created: number;
  duration_ms: number | null;
  created_at: string;
};

const CHAIN_COLUMNS = "id, name, slug, description, is_active, created_at";
const STEP_COLUMNS =
  "id, chain_id, step_order, label, template, is_active, created_at";

/**
 * Chains with their step counts.
 *
 * The counts are grouped here rather than asked of PostgREST as an aggregate:
 * there are a handful of chains, and one plain select each is easier to read
 * back than an embedded count whose shape changes with the relationship.
 */
export async function listChains(): Promise<ChainSummary[]> {
  const supabase = await createClient();

  const [chainsRes, stepsRes] = await Promise.all([
    supabase.from("prompt_chains").select(CHAIN_COLUMNS).order("name"),
    supabase.from("prompt_chain_steps").select("chain_id, is_active"),
  ]);

  if (chainsRes.error) throw new Error(chainsRes.error.message);

  const steps = stepsRes.data ?? [];
  return ((chainsRes.data ?? []) as Chain[]).map((c) => ({
    ...c,
    stepCount: steps.filter((s) => s.chain_id === c.id).length,
    activeStepCount: steps.filter((s) => s.chain_id === c.id && s.is_active)
      .length,
  }));
}

export async function getChain(id: number): Promise<Chain | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prompt_chains")
    .select(CHAIN_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as Chain | null) ?? null;
}

export async function getSteps(chainId: number): Promise<Step[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prompt_chain_steps")
    .select(STEP_COLUMNS)
    .eq("chain_id", chainId)
    .order("step_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Step[];
}

export async function getStep(id: number): Promise<Step | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prompt_chain_steps")
    .select(STEP_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as Step | null) ?? null;
}

export async function listImages(): Promise<ImageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("images")
    .select("id, path, public_url, alt_text")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) throw new Error(error.message);
  return (data ?? []) as ImageRow[];
}

export async function getImage(id: number): Promise<ImageRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("images")
    .select("id, path, public_url, alt_text")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ImageRow | null) ?? null;
}

/**
 * Captions this chain produced.
 *
 * generations does not carry a chain_id -- it points at the request, and the
 * request knows the chain. The !inner embed turns that into a join so the
 * filter can be applied to the parent, which is what makes "media produced by
 * this chain" a single query rather than two round trips.
 */
export async function listChainMedia(chainId: number): Promise<MediaRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generations")
    .select(
      "id, caption, score, up_votes, down_votes, created_at, request_id, generation_requests!inner(chain_id)",
    )
    .eq("generation_requests.chain_id", chainId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MediaRow[];
}

export async function listChainRuns(chainId: number): Promise<RunRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generation_requests")
    .select("id, topic, status, error, captions_created, duration_ms, created_at")
    .eq("chain_id", chainId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) throw new Error(error.message);
  return (data ?? []) as RunRow[];
}

/** Turns a chain name into the unique slug the table requires. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
