import Replicate from 'replicate';

// ── Model constants ───────────────────────────────────────────────────────────

// Primary ControlNet interior-design model
const PRIMARY_MODEL = 'adirik/interior-design';

// Fallback img2img (used if primary fails)
const FALLBACK_MODEL =
  'stability-ai/stable-diffusion-img2img:15a3689ee13b0d2616e98820eca31d4c3abcd36672df6afce5cb6feb1d66087d';

// txt2img: stable-diffusion for draft renders (Step 2 in BTI pipeline)
const SD_TXT2IMG_MODEL =
  'stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750d3b63264e9748c9a57ae3c00d';

// Depth estimation (Step 3 in BTI pipeline)
const MIDAS_MODEL =
  'cjwbw/midas:a6ba5798f04f80d3b314de0f0a62277f21ab3503c60c84d4817de83c5edfdae0';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GenerationParams = {
  depthMapUrl: string;
  prompt: string;
  negativePrompt: string;
  numOutputs: 2 | 4;
  controlWeight: number;
  roomType: string;
  anonUuid: string;
  strength?: number;      // denoising strength, default 0.8
  guidanceScale?: number; // cfg scale, default 15
};

export type DraftRenderParams = {
  roomName: string;
  style: string;
  apartmentType?: string;
};

// ── Shared helpers ────────────────────────────────────────────────────────────

function getClient(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('Missing REPLICATE_API_TOKEN environment variable.');
  return new Replicate({ auth: token });
}

function extractUrls(output: unknown): string[] {
  const items = Array.isArray(output) ? output : [output];
  return items.map((item: unknown) => {
    if (typeof item === 'string') return item;
    const obj = item as Record<string, unknown>;
    if (typeof obj?.url === 'function') return (obj.url as () => string)();
    if (typeof obj?.url === 'string') return obj.url;
    return String(item);
  }).filter(Boolean);
}

// ── Step 4 / photo render (ControlNet interior design) ───────────────────────

export async function generate(params: GenerationParams): Promise<string[]> {
  const provider = (process.env.GENERATION_PROVIDER ?? 'replicate').trim();
  if (provider === 'replicate') {
    return await generateReplicate(params);
  }
  throw new Error(`Unsupported generation provider: ${provider}`);
}

async function generateReplicate(params: GenerationParams): Promise<string[]> {
  const client = getClient();
  const strength = params.strength ?? 0.8;
  const guidanceScale = params.guidanceScale ?? 15;

  // Try primary model (adirik/interior-design)
  try {
    console.log('[adapter] Primary model:', PRIMARY_MODEL);
    const output = await client.run(PRIMARY_MODEL as `${string}/${string}`, {
      input: {
        image: params.depthMapUrl,
        prompt: params.prompt,
        negative_prompt: params.negativePrompt,
        guidance_scale: guidanceScale,
        num_inference_steps: 50,
        prompt_strength: strength,
      },
    });
    if (output) return extractUrls(output);
  } catch (err) {
    console.warn('[adapter] Primary model failed, falling back:', err instanceof Error ? err.message : err);
  }

  // Fallback: stability-ai img2img
  console.log('[adapter] Using fallback model:', FALLBACK_MODEL);
  const fallbackOutput = await client.run(FALLBACK_MODEL as `${string}/${string}:${string}`, {
    input: {
      image: params.depthMapUrl,
      prompt: params.prompt,
      negative_prompt: params.negativePrompt,
      guidance_scale: guidanceScale,
      prompt_strength: strength,
      num_inference_steps: 30,
      num_outputs: 1,
    },
  });

  if (!fallbackOutput) {
    throw new Error('Both primary and fallback generation providers returned no output.');
  }
  return extractUrls(fallbackOutput);
}

// ── Step 2: Draft render via txt2img ─────────────────────────────────────────

export async function generateDraftRender(params: DraftRenderParams): Promise<string> {
  const client = getClient();

  const prompt = [
    `empty ${params.roomName} interior`,
    params.style ? `${params.style} style` : null,
    'neutral light gray walls, bare concrete floor',
    'no furniture, no decorations, no people',
    'photorealistic architectural photography',
    'natural daylight from windows, 8K, wide angle shot',
  ].filter(Boolean).join(', ');

  const negativePrompt =
    'furniture, people, decorations, artwork, plants, clutter, text, watermark, low quality, blurry, dark';

  console.log('[generateDraftRender] room:', params.roomName, '| style:', params.style);

  const output = await client.run(SD_TXT2IMG_MODEL as `${string}/${string}:${string}`, {
    input: {
      prompt,
      negative_prompt: negativePrompt,
      width: 512,
      height: 512,
      guidance_scale: 7.5,
      num_inference_steps: 30,
      num_outputs: 1,
    },
  });

  const urls = extractUrls(output);
  if (!urls[0]) throw new Error('generateDraftRender: no output URL returned');
  console.log('[generateDraftRender] done:', urls[0].slice(0, 60));
  return urls[0];
}

// ── Step 4 (alternative): Depth-conditioned ControlNet ──────────────────────
// Takes a precomputed depth map (e.g. from MiDaS) and a style prompt, returns
// renders that actually use the depth map as ControlNet conditioning.
//
// Model is configured via env var REPLICATE_CONTROLNET_DEPTH_MODEL in the form
// "owner/name:sha" so it can be swapped without code changes. If unset or if
// the call fails, the caller falls back to the standard generate() path
// (adirik/interior-design with the draft render).

export type DepthControlNetParams = {
  depthMapUrl: string;
  prompt: string;
  negativePrompt: string;
  numOutputs?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
};

export async function generateWithDepthControlNet(
  params: DepthControlNetParams
): Promise<string[]> {
  const modelRef = process.env.REPLICATE_CONTROLNET_DEPTH_MODEL?.trim();
  if (!modelRef) {
    throw new Error('REPLICATE_CONTROLNET_DEPTH_MODEL_NOT_CONFIGURED');
  }

  const client = getClient();
  console.log('[depth-controlnet] Calling model:', modelRef, '| depth:', params.depthMapUrl.slice(0, 70));

  // Most modern ControlNet wrappers on Replicate accept the same parameter
  // shape: image (control image), prompt, negative_prompt, num_outputs,
  // num_inference_steps, guidance_scale. Unknown params are ignored.
  const output = await client.run(modelRef as `${string}/${string}:${string}`, {
    input: {
      image: params.depthMapUrl,
      prompt: params.prompt,
      negative_prompt: params.negativePrompt,
      num_outputs: params.numOutputs ?? 1,
      num_inference_steps: params.numInferenceSteps ?? 30,
      guidance_scale: params.guidanceScale ?? 7.5,
    },
  });

  const urls = extractUrls(output);
  if (urls.length === 0) {
    throw new Error('generateWithDepthControlNet: no output URLs returned');
  }
  console.log('[depth-controlnet] Got', urls.length, 'render(s)');
  return urls;
}

// ── Step 3: Depth map via MiDaS ──────────────────────────────────────────────

export async function generateDepthMap(imageUrl: string): Promise<string> {
  const client = getClient();

  console.log('[generateDepthMap] input:', imageUrl.slice(0, 80));

  const output = await client.run(MIDAS_MODEL as `${string}/${string}:${string}`, {
    input: {
      model_type: 'dpt_beit_large_512',
      image: imageUrl,
    },
  });

  const urls = extractUrls(output);
  if (!urls[0]) throw new Error('generateDepthMap: no output URL returned');
  console.log('[generateDepthMap] done:', urls[0].slice(0, 60));
  return urls[0];
}
