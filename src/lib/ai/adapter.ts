import Replicate from 'replicate';

// ── Model constants ───────────────────────────────────────────────────────────

// Primary ControlNet interior-design model (versioned SHA required by Replicate /v1/predictions)
const PRIMARY_MODEL = 'adirik/interior-design:76604baddc85b1b4616e1c6475eca080da339c8b';

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
  numOutputs: 1 | 2 | 4;
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
    // Replicate FileOutput: .url() returns a URL object, not a string
    if (item && typeof obj.url === 'function') return (obj.url as () => { toString(): string })().toString();
    if (item && typeof obj.url === 'string') return obj.url;
    if (item) return String(item);
    return '';
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

// ── SDXL Multi-ControlNet (dual depth+lineart conditioning) ──────────────────
// Uses fofr/sdxl-multi-controlnet-lora on Replicate, pinned to a specific
// version SHA so the SDK routes to /v1/predictions (community model endpoint)
// rather than /v1/models/.../predictions (which 404s for community models).
//
// Verified parameter names (cog source):
//   prompt, negative_prompt, num_outputs, num_inference_steps, guidance_scale
//   controlnet_1, controlnet_1_image, controlnet_1_conditioning_scale,
//   controlnet_1_start, controlnet_1_end
//   controlnet_2, controlnet_2_image, controlnet_2_conditioning_scale,
//   controlnet_2_start, controlnet_2_end
// Controlnet choices: 'depth_midas', 'depth_leres', 'lineart', 'lineart_anime',
//   'canny', 'edge_canny', 'openpose', 'soft_edge_hed', 'soft_edge_pidi', ...

// RealVisXL V3 multi-controlnet — same parameter interface as the old SDXL model
// but fine-tuned on professional interior/architectural photography.
//
// Community models on Replicate require a pinned version SHA so the SDK routes
// to /v1/predictions; { model: 'owner/name' } hits /v1/models/.../predictions
// which 404s for community models.  We resolve the SHA dynamically from the
// public model endpoint and cache it per process lifetime so there's no
// hardcoded pin to maintain.  The resolved SHA is logged on first call.
const REALVISXL_MULTI_CONTROLNET = 'fofr/realvisxl-v3-multi-controlnet-lora';
let _realvisxlSha: string | null = null;

async function resolveRealVisXLSha(): Promise<string> {
  if (_realvisxlSha) return _realvisxlSha;

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('Missing REPLICATE_API_TOKEN');

  const res = await fetch(
    `https://api.replicate.com/v1/models/${REALVISXL_MULTI_CONTROLNET}`,
    { headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' } },
  );
  if (!res.ok) {
    throw new Error(`Replicate model lookup failed ${res.status} ${res.statusText} for ${REALVISXL_MULTI_CONTROLNET}`);
  }

  const data = await res.json() as { latest_version?: { id?: string } };
  const sha = data.latest_version?.id;
  if (!sha) throw new Error(`No latest_version.id for ${REALVISXL_MULTI_CONTROLNET}`);

  _realvisxlSha = sha;
  console.log(`[realvisxl-controlnet] model=${REALVISXL_MULTI_CONTROLNET} latest SHA=${sha}`);
  return sha;
}

export type SdxlMultiControlnetParams = {
  /** Public URL of the grayscale depth PNG */
  depthMapUrl: string;
  /** Public URL of the white-bg black-edge lineart PNG */
  lineartUrl: string;
  prompt: string;
  negativePrompt?: string;
  numOutputs?: 1 | 2 | 4;
  numInferenceSteps?: number;
  /** ControlNet conditioning scale for depth (default 0.7) */
  depthScale?: number;
  /** ControlNet conditioning scale for lineart (default 0.4) */
  lineartScale?: number;
  /** Optional reference photo URL fed as IP-Adapter image (style transfer) */
  ipAdapterImage?: string | null;
  /** IP-Adapter conditioning weight — default 0.7 */
  ipAdapterWeight?: number;
};

export async function generateSdxlMultiControlnet(
  params: SdxlMultiControlnetParams,
): Promise<string> {
  const client = getClient();

  const numOutputs      = params.numOutputs        ?? 1;
  const inferenceSteps  = params.numInferenceSteps  ?? 50;
  const depthScale      = params.depthScale         ?? 0.7;
  const lineartScale    = params.lineartScale       ?? 0.4;
  const ipAdapterWeight = params.ipAdapterWeight    ?? 0.7;
  const hasIpAdapter    = Boolean(params.ipAdapterImage);

  const input: Record<string, unknown> = {
    prompt:                            params.prompt,
    negative_prompt:                   params.negativePrompt ?? 'bad geometry, distorted walls, unrealistic proportions, warped perspective, blurry, low quality, cartoon, watermark, text, sparse furniture, empty room, minimal styling, bare walls, cluttered, messy, CGI plastic look, harsh fluorescent lighting, oversaturated colors',
    num_outputs:                       numOutputs,
    num_inference_steps:               inferenceSteps,
    guidance_scale:                    7.5,
    scheduler:                         'DPM++ 2M Karras',
    controlnet_1:                      'depth_midas',
    controlnet_1_image:                params.depthMapUrl,
    controlnet_1_conditioning_scale:   depthScale,
    controlnet_1_start:                0.0,
    controlnet_1_end:                  1.0,
    controlnet_2:                      'lineart',
    controlnet_2_image:                params.lineartUrl,
    controlnet_2_conditioning_scale:   lineartScale,
    controlnet_2_start:                0.0,
    controlnet_2_end:                  1.0,
    // IP-Adapter — only included when a reference photo is provided
    ...(hasIpAdapter ? {
      ip_adapter_image:  params.ipAdapterImage,
      ip_adapter_weight: ipAdapterWeight,
    } : {}),
  };

  console.log(
    '[realvisxl-controlnet] Creating prediction (async) |',
    'outputs:', numOutputs,
    '| steps:', inferenceSteps,
    '| depth_scale:', depthScale,
    '| lineart_scale:', lineartScale,
    `| ip_adapter: ${hasIpAdapter ? `yes (weight ${ipAdapterWeight})` : 'no'}`,
    '| depth:', params.depthMapUrl.slice(0, 70),
    '| lineart:', params.lineartUrl.slice(0, 70),
  );

  let prediction: { id: string };
  try {
    // Resolve the version SHA dynamically (cached per process) so the SDK
    // routes to /v1/predictions — the community-model endpoint that works.
    const versionSha = await resolveRealVisXLSha();
    console.log('[realvisxl-controlnet] Using version SHA:', versionSha.slice(0, 16) + '…');
    prediction = await client.predictions.create({ version: versionSha, input });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[realvisxl-controlnet] predictions.create FAILED:', msg);
    console.error('[realvisxl-controlnet] Input sent:', JSON.stringify(input, null, 2));
    if (err && typeof err === 'object') {
      const e = err as Record<string, unknown>;
      if (e.response) console.error('[realvisxl-controlnet] response:', JSON.stringify(e.response));
      if (e.detail)   console.error('[realvisxl-controlnet] detail:',   JSON.stringify(e.detail));
    }
    throw new Error(`generateSdxlMultiControlnet: ${msg}`);
  }

  console.log('[realvisxl-controlnet] Prediction created, id:', prediction.id);
  return prediction.id;
}

// ── Prediction polling helper ─────────────────────────────────────────────────
// Used by the status endpoint to resolve pending SDXL predictions without
// blocking the original /api/generate function.

export type ReplicatePredictionStatus =
  | 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';

export type PredictionResult = {
  id: string;
  status: ReplicatePredictionStatus;
  urls: string[];     // populated only when status === 'succeeded'
  error: string | null;
};

export async function getPrediction(predictionId: string): Promise<PredictionResult> {
  const client = getClient();
  const pred = await client.predictions.get(predictionId);
  const status = pred.status as ReplicatePredictionStatus;

  let urls: string[] = [];
  if (status === 'succeeded') {
    const rawUrls = extractUrls(pred.output);

    // fofr/sdxl-multi-controlnet-lora returns the rendered output(s) FIRST,
    // followed by preprocessed control images (filenames `control-N.png`).
    // Strip those out so render_urls only contains real renders.
    const CONTROL_RE = /\/control-\d+\.png(?:\?.*)?$/i;
    const filtered = rawUrls.filter(u => !CONTROL_RE.test(u));

    // As a second safety belt, trim to the prediction's declared num_outputs.
    const input = (pred as { input?: Record<string, unknown> }).input ?? {};
    const rawN = Number((input as Record<string, unknown>).num_outputs);
    const n = Number.isFinite(rawN) && rawN > 0 ? Math.floor(rawN) : filtered.length;
    urls = filtered.slice(0, n);

    console.log(
      '[realvisxl-controlnet] Prediction outputs raw count:', rawUrls.length,
      ', kept:', urls.length, '(after filtering control maps)',
    );
  }

  return {
    id:     pred.id,
    status,
    urls,
    error:  typeof pred.error === 'string' ? pred.error : pred.error ? String(pred.error) : null,
  };
}

// ── Flux Depth Pro (v2 BTI pipeline) ─────────────────────────────────────────
// Official Black Forest Labs model — no version SHA, uses the /models/ endpoint.
// control_image must be a publicly accessible PNG/JPEG URL (e.g. Supabase Storage
// signed URL). Returns an array of output image URLs.

export type FluxDepthProParams = {
  /** URL of the procedural depth map (output of generateDepthMapBuffer uploaded to storage) */
  controlImage: string;
  prompt: string;
  negativePrompt?: string;
  numOutputs?: 1 | 2 | 4;
  numInferenceSteps?: number;
  guidanceScale?: number;
  /** 0–1 — how strongly the depth map controls the output, default 0.85 */
  controlStrength?: number;
};

export async function generateFluxDepthPro(params: FluxDepthProParams): Promise<string[]> {
  const client = getClient();

  const numOutputs      = params.numOutputs        ?? 1;
  const inferenceSteps  = params.numInferenceSteps  ?? 28;
  const guidanceScale   = params.guidanceScale       ?? 3.5;
  const controlStrength = params.controlStrength     ?? 0.85;

  console.log(
    '[flux-depth-pro] Starting | outputs:', numOutputs,
    '| steps:', inferenceSteps,
    '| guidance:', guidanceScale,
    '| control_strength:', controlStrength,
    '| control_image:', params.controlImage.slice(0, 80),
  );

  const fluxInput = {
    prompt:              params.prompt,
    control_image:       params.controlImage,
    negative_prompt:     params.negativePrompt ?? '',
    num_outputs:         numOutputs,
    num_inference_steps: inferenceSteps,
    guidance_scale:      guidanceScale,
    control_strength:    controlStrength,
    output_format:       'png',
    output_quality:      90,
  };

  // The Replicate SDK routes calls without a version SHA to the official
  // /v1/models/<owner>/<name>/predictions endpoint automatically.
  let output: unknown;
  try {
    output = await client.run('black-forest-labs/flux-depth-pro' as `${string}/${string}`, { input: fluxInput });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = msg.includes('429') || /rate.?limit|too.?many.?requests/i.test(msg);
    if (is429) {
      const afterMatch = msg.match(/retry.?after[:\s]+(\d+)/i);
      const waitSec = afterMatch ? parseInt(afterMatch[1], 10) : 10;
      console.warn(`[flux-depth-pro] 429 rate limit — retrying after ${waitSec}s`);
      await new Promise(r => setTimeout(r, waitSec * 1000));
      output = await client.run('black-forest-labs/flux-depth-pro' as `${string}/${string}`, { input: fluxInput });
    } else {
      throw err;
    }
  }

  if (!output) {
    throw new Error('generateFluxDepthPro: Replicate returned no output');
  }

  const urls = extractUrls(output);
  if (urls.length === 0) {
    throw new Error('generateFluxDepthPro: no output URLs in response');
  }

  console.log('[flux-depth-pro] Done —', urls.length, 'render(s):', urls[0].slice(0, 70));
  return urls;
}
