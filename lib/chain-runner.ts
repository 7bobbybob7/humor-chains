import { GoogleGenAI, Type, type Content } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

export const CAPTIONS_PER_RUN = 5;

/** Raw model output is stored for inspection; cap it so one row cannot balloon. */
const MAX_RAW_STORED = 4000;

/** How long one model gets to answer before the chain moves on without it. */
const ATTEMPT_TIMEOUT_MS = 9_000;

/**
 * Budget for the whole run, across every step.
 *
 * A chain is several model calls in series, so the per-step costs add up in a
 * way a single generation's never did. The route allows 60s; stopping at 50
 * leaves room to record the failure and answer, instead of being killed
 * mid-call and surfacing as a blank error page.
 */
const TOTAL_BUDGET_MS = 50_000;

/** Used only when the database has no models configured. */
const FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest"];

type ModelRow = { id: number; model_key: string };

export type ChainStep = {
  id: number;
  step_order: number;
  label: string;
  template: string;
};

export type StepRun = {
  stepId: number;
  position: number;
  label: string;
  prompt: string;
  output: string;
  model: string;
  latencyMs: number;
};

export type ChainRunResult = {
  requestId: number | null;
  steps: StepRun[];
  captions: string[];
  durationMs: number;
};

class AttemptTimeout extends Error {
  constructor(ms: number) {
    super(`No answer within ${ms}ms.`);
    this.name = "AttemptTimeout";
  }
}

function retryable(status: number | undefined): boolean {
  return (
    status === undefined ||
    status === 503 ||
    status === 429 ||
    status === 500 ||
    status === 504
  );
}

function mimeFromPath(path: string): string {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

/** Fills the placeholders a step template may use. */
function render(
  template: string,
  vars: { input: string; topic: string; count: number },
): string {
  return template
    .replaceAll("{{input}}", vars.input)
    .replaceAll("{{topic}}", vars.topic)
    .replaceAll("{{count}}", String(vars.count))
    .trim();
}

/**
 * Captions out of the final step.
 *
 * The last step asks for a JSON array, but a model under load sometimes
 * answers in prose anyway, so a newline-separated fallback keeps a run from
 * being thrown away over formatting. Leading list markers are stripped.
 */
function parseCaptions(raw: string | undefined): string[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const out = parsed
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.trim())
        .filter(Boolean);
      if (out.length > 0) return out.slice(0, CAPTIONS_PER_RUN);
    }
  } catch {
    // Fall through to the prose reading below.
  }

  return raw
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .map((l) => l.replace(/^["']|["']$/g, "").trim())
    .filter(Boolean)
    .slice(0, CAPTIONS_PER_RUN);
}

/** One model call, abandoned at `ms`. */
async function callWithTimeout(
  ai: GoogleGenAI,
  modelKey: string,
  contents: string | Content[],
  wantJsonArray: boolean,
  ms: number,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await ai.models.generateContent({
      model: modelKey,
      contents,
      config: {
        temperature: 1.05,
        abortSignal: controller.signal,
        ...(wantJsonArray
          ? {
              responseMimeType: "application/json",
              responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
            }
          : {}),
      },
    });
  } catch (e) {
    if (controller.signal.aborted) throw new AttemptTimeout(ms);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs a prompt chain, step by step.
 *
 * Each step is its own model call, and its text output becomes the next step's
 * {{input}}. That is the whole point of a chain and the reason this does not
 * reuse the public app's pipeline, which concatenates every step into one
 * prompt and so can never feed an image through a describe-then-joke sequence.
 *
 * Every step is recorded in llm_responses against its step_id, so a run can be
 * read back afterwards and a weak step identified.
 */
export async function runChain(opts: {
  userId: string;
  chainId: number;
  steps: ChainStep[];
  topic: string;
  image?: { id: number; publicUrl: string; path: string } | null;
}): Promise<ChainRunResult> {
  const { userId, chainId, steps, topic, image } = opts;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Add it to .env.local locally, and to Environment Variables on Vercel.",
    );
  }
  if (steps.length === 0) {
    throw new Error("This chain has no active steps, so there is nothing to run.");
  }

  const supabase = await createClient();
  const startedAt = Date.now();

  const { data: modelRows } = await supabase
    .from("llm_models")
    .select("id, model_key")
    .eq("is_active", true)
    .order("priority", { ascending: true });

  const models: ModelRow[] = modelRows?.length
    ? (modelRows as ModelRow[])
    : FALLBACK_MODELS.map((k) => ({ id: 0, model_key: k }));

  const { data: requestRow } = await supabase
    .from("generation_requests")
    .insert({
      user_id: userId,
      topic,
      chain_id: chainId,
      image_id: image?.id ?? null,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  const requestId = (requestRow?.id as number | undefined) ?? null;

  async function fail(reason: string): Promise<never> {
    if (requestId) {
      await supabase
        .from("generation_requests")
        .update({
          status: "failed",
          error: reason.slice(0, 500),
          duration_ms: Date.now() - startedAt,
        })
        .eq("id", requestId);
    }
    throw new Error(reason);
  }

  // Fetched once, not per step: only the first step is given the image.
  let imagePart: Content["parts"] | null = null;
  if (image) {
    try {
      const res = await fetch(image.publicUrl, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`storage returned ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      imagePart = [
        {
          inlineData: {
            mimeType: mimeFromPath(image.path),
            data: bytes.toString("base64"),
          },
        },
      ];
    } catch (e) {
      await fail(
        `Could not read the selected image: ${
          e instanceof Error ? e.message : "unknown error"
        }`,
      );
    }
  }

  const ai = new GoogleGenAI({ apiKey });
  const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);
  const done: StepRun[] = [];
  let carried = topic;

  // Once a model answers, it is tried first for the remaining steps. Without
  // this, a chain re-pays the timeout for a stalled high-priority model on
  // every single step, which is what pushes a three-step run past the budget.
  let preferred: string | null = null;

  for (const [index, step] of ordered.entries()) {
    const isLast = index === ordered.length - 1;
    const prompt = render(step.template, {
      input: carried,
      topic,
      count: CAPTIONS_PER_RUN,
    });

    if (!prompt) {
      await fail(`Step ${index + 1} ("${step.label}") renders to an empty prompt.`);
    }

    const contents: string | Content[] =
      index === 0 && imagePart
        ? [{ role: "user", parts: [...imagePart, { text: prompt }] }]
        : prompt;

    const queue: ModelRow[] = preferred
      ? [
          ...models.filter((m) => m.model_key === preferred),
          ...models.filter((m) => m.model_key !== preferred),
        ]
      : models;

    let output = "";
    let usedModel = "";
    let latency = 0;
    let lastError = "No model was attempted.";

    for (const model of queue) {
      const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
      if (remaining < 1_000) {
        lastError = "Ran out of time part-way through the chain.";
        break;
      }

      const attemptStart = Date.now();
      try {
        const response = await callWithTimeout(
          ai,
          model.model_key,
          contents,
          isLast,
          Math.min(ATTEMPT_TIMEOUT_MS, remaining),
        );
        latency = Date.now() - attemptStart;
        const text = (response.text ?? "").trim();

        if (requestId) {
          await supabase.from("llm_responses").insert({
            request_id: requestId,
            step_id: step.id,
            model_id: model.id || null,
            model_key: model.model_key,
            ok: text.length > 0,
            status_code: 200,
            latency_ms: latency,
            raw_response: text.slice(0, MAX_RAW_STORED),
            error: text.length > 0 ? null : "Empty response.",
          });
        }

        if (text.length > 0) {
          output = text;
          usedModel = model.model_key;
          preferred = model.model_key;
          break;
        }
        lastError = `${model.model_key} returned an empty response.`;
      } catch (e) {
        latency = Date.now() - attemptStart;
        const status = (e as { status?: number }).status;
        const message = e instanceof Error ? e.message : String(e);
        lastError = message;

        if (requestId) {
          await supabase.from("llm_responses").insert({
            request_id: requestId,
            step_id: step.id,
            model_id: model.id || null,
            model_key: model.model_key,
            ok: false,
            status_code: status ?? null,
            latency_ms: latency,
            error: message.slice(0, MAX_RAW_STORED),
          });
        }

        if (status === 400 || status === 401 || status === 403) {
          await fail(
            "Gemini rejected the API key. Check GEMINI_API_KEY is valid and has access.",
          );
        }
        if (!retryable(status) && status !== 404) await fail(message);
      }
    }

    if (!output) {
      await fail(
        `Step ${index + 1} ("${step.label}") failed on every model. ${lastError.slice(0, 160)}`,
      );
    }

    done.push({
      stepId: step.id,
      position: index + 1,
      label: step.label,
      prompt,
      output,
      model: usedModel,
      latencyMs: latency,
    });
    carried = output;
  }

  const captions = parseCaptions(done[done.length - 1]?.output);
  if (captions.length === 0) {
    await fail("The last step produced nothing usable as captions.");
  }

  const finalPrompt = done[done.length - 1]?.prompt ?? "";
  const finalModel = done[done.length - 1]?.model ?? "unknown";

  const { error: insertError } = await supabase.from("generations").insert(
    captions.map((caption) => ({
      user_id: userId,
      prompt: topic,
      system_prompt: finalPrompt,
      model: finalModel,
      request_id: requestId,
      caption,
    })),
  );

  if (insertError) {
    await fail(`Saving the captions failed: ${insertError.message}`);
  }

  const durationMs = Date.now() - startedAt;
  if (requestId) {
    await supabase
      .from("generation_requests")
      .update({
        status: "succeeded",
        captions_created: captions.length,
        duration_ms: durationMs,
      })
      .eq("id", requestId);
  }

  return { requestId, steps: done, captions, durationMs };
}
