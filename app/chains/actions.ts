"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { getImage, getSteps, slugify } from "@/lib/chains";
import { runChain, type ChainRunResult } from "@/lib/chain-runner";

export type FormState = { error?: string; success?: string };
export type RunState = { error?: string; result?: ChainRunResult };

const MAX_NAME = 80;
const MAX_DESCRIPTION = 400;
const MAX_LABEL = 80;
const MAX_TEMPLATE = 4000;
const MAX_TOPIC = 160;

function num(formData: FormData, key: string): number | null {
  const n = Number(formData.get(key));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* --------------------------------------------------------------- chain CRUD */

export async function createChain(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperadmin();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) return { error: "Give the chain a name." };
  if (name.length > MAX_NAME) {
    return { error: `Keep the name under ${MAX_NAME} characters.` };
  }
  if (description.length > MAX_DESCRIPTION) {
    return { error: `Keep the description under ${MAX_DESCRIPTION} characters.` };
  }

  const slug = slugify(name);
  if (!slug) {
    return { error: "That name has no letters or digits to build a slug from." };
  }

  let newId: number;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("prompt_chains")
      .insert({ name, slug, description: description || null })
      .select("id")
      .maybeSingle();

    if (error) {
      // The table requires a unique slug, and two differently-punctuated
      // names can slugify to the same thing.
      if (error.code === "23505") {
        return { error: `A chain with the slug "${slug}" already exists.` };
      }
      return { error: `Could not create the chain: ${error.message}` };
    }
    if (!data?.id) {
      return { error: "The chain was not created. Check your admin access." };
    }
    newId = data.id as number;
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "The database was unreachable.",
    };
  }

  revalidatePath("/");
  redirect(`/chains/${newId}`);
}

export async function updateChain(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperadmin();

  const id = num(formData, "id");
  if (!id) return { error: "Bad chain id." };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  if (!name) return { error: "Give the chain a name." };
  if (name.length > MAX_NAME) {
    return { error: `Keep the name under ${MAX_NAME} characters.` };
  }
  if (description.length > MAX_DESCRIPTION) {
    return { error: `Keep the description under ${MAX_DESCRIPTION} characters.` };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("prompt_chains")
      .update({ name, description: description || null, is_active: isActive })
      .eq("id", id)
      .select("id");

    if (error) return { error: `Could not save: ${error.message}` };
    // An UPDATE the policy filters out changes zero rows and raises nothing,
    // so without this a failed write would report success.
    if (!data || data.length === 0) {
      return { error: "Nothing was saved — the chain may have been deleted." };
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "The database was unreachable.",
    };
  }

  revalidatePath("/");
  revalidatePath(`/chains/${id}`);
  return { success: "Saved." };
}

export async function deleteChain(formData: FormData): Promise<void> {
  await requireSuperadmin();

  const id = num(formData, "id");
  if (!id) redirect("/?failed=bad-id");

  const supabase = await createClient();
  // Steps cascade with the chain; generation_requests keep their history with
  // chain_id set to null.
  const { data, error } = await supabase
    .from("prompt_chains")
    .delete()
    .eq("id", id)
    .select("id");

  revalidatePath("/");

  if (error) redirect(`/?failed=${encodeURIComponent(error.message)}`);
  if (!data || data.length === 0) redirect("/?failed=nothing-deleted");

  redirect("/?deleted=1");
}

/* ---------------------------------------------------------------- step CRUD */

export async function createStep(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperadmin();

  const chainId = num(formData, "chain_id");
  if (!chainId) return { error: "Bad chain id." };

  const label = String(formData.get("label") ?? "").trim();
  const template = String(formData.get("template") ?? "").trim();

  if (!label) return { error: "Give the step a label." };
  if (label.length > MAX_LABEL) {
    return { error: `Keep the label under ${MAX_LABEL} characters.` };
  }
  if (!template) return { error: "The step needs a prompt template." };
  if (template.length > MAX_TEMPLATE) {
    return { error: `Keep the template under ${MAX_TEMPLATE} characters.` };
  }

  try {
    const existing = await getSteps(chainId);
    const nextOrder =
      existing.reduce((max, s) => Math.max(max, s.step_order), 0) + 1;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("prompt_chain_steps")
      .insert({
        chain_id: chainId,
        step_order: nextOrder,
        label,
        template,
      })
      .select("id");

    if (error) {
      if (error.code === "23505") {
        return {
          error: "That position was taken while you were editing. Try again.",
        };
      }
      return { error: `Could not add the step: ${error.message}` };
    }
    if (!data || data.length === 0) {
      return { error: "The step was not added. Check your admin access." };
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "The database was unreachable.",
    };
  }

  revalidatePath("/");
  revalidatePath(`/chains/${chainId}`);
  return { success: "Step added." };
}

export async function updateStep(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperadmin();

  const id = num(formData, "id");
  const chainId = num(formData, "chain_id");
  if (!id || !chainId) return { error: "Bad step id." };

  const label = String(formData.get("label") ?? "").trim();
  const template = String(formData.get("template") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  if (!label) return { error: "Give the step a label." };
  if (label.length > MAX_LABEL) {
    return { error: `Keep the label under ${MAX_LABEL} characters.` };
  }
  if (!template) return { error: "The step needs a prompt template." };
  if (template.length > MAX_TEMPLATE) {
    return { error: `Keep the template under ${MAX_TEMPLATE} characters.` };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("prompt_chain_steps")
      .update({ label, template, is_active: isActive })
      .eq("id", id)
      .select("id");

    if (error) return { error: `Could not save: ${error.message}` };
    if (!data || data.length === 0) {
      return { error: "Nothing was saved — the step may have been deleted." };
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "The database was unreachable.",
    };
  }

  revalidatePath(`/chains/${chainId}`);
  return { success: "Saved." };
}

export async function deleteStep(formData: FormData): Promise<void> {
  await requireSuperadmin();

  const id = num(formData, "id");
  const chainId = num(formData, "chain_id");
  if (!id || !chainId) redirect("/?failed=bad-id");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prompt_chain_steps")
    .delete()
    .eq("id", id)
    .select("id");

  revalidatePath(`/chains/${chainId}`);

  if (error) {
    redirect(`/chains/${chainId}?failed=${encodeURIComponent(error.message)}`);
  }
  if (!data || data.length === 0) {
    redirect(`/chains/${chainId}?failed=nothing-deleted`);
  }

  redirect(`/chains/${chainId}?deleted=step`);
}

/* ----------------------------------------------------------------- reorder */

/**
 * Moves a step one position up or down.
 *
 * The swap runs inside move_chain_step because the unique index on
 * (chain_id, step_order) is checked row by row: setting step 2 to order 1
 * while step 1 still holds it fails, so the two updates have to share a
 * transaction with the constraint deferred. That is not expressible over
 * PostgREST, which sends each update on its own.
 */
export async function moveStep(formData: FormData): Promise<void> {
  await requireSuperadmin();

  const id = num(formData, "id");
  const chainId = num(formData, "chain_id");
  const direction = String(formData.get("direction") ?? "");

  if (!id || !chainId || (direction !== "up" && direction !== "down")) {
    redirect(`/chains/${chainId ?? ""}?failed=bad-move`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("move_chain_step", {
    p_step_id: id,
    p_direction: direction === "up" ? -1 : 1,
  });

  revalidatePath(`/chains/${chainId}`);

  if (error) {
    redirect(`/chains/${chainId}?failed=${encodeURIComponent(error.message)}`);
  }
  redirect(`/chains/${chainId}`);
}

/* --------------------------------------------------------------------- run */

export async function runChainAction(
  _prev: RunState,
  formData: FormData,
): Promise<RunState> {
  const admin = await requireSuperadmin();

  const chainId = num(formData, "chain_id");
  if (!chainId) return { error: "Bad chain id." };

  const topic = String(formData.get("topic") ?? "").trim();
  if (!topic) return { error: "Give the chain something to work with." };
  if (topic.length > MAX_TOPIC) {
    return { error: `Keep the topic under ${MAX_TOPIC} characters.` };
  }

  const imageId = num(formData, "image_id");

  try {
    const steps = (await getSteps(chainId)).filter((s) => s.is_active);
    const image = imageId ? await getImage(imageId) : null;

    if (imageId && !image) {
      return { error: "That image no longer exists." };
    }

    const result = await runChain({
      userId: admin.id,
      chainId,
      steps,
      topic,
      image: image
        ? { id: image.id, publicUrl: image.public_url, path: image.path }
        : null,
    });

    revalidatePath(`/chains/${chainId}`);
    revalidatePath(`/chains/${chainId}/media`);
    return { result };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "The chain run failed.",
    };
  }
}
