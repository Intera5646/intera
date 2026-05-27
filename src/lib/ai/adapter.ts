import Replicate from 'replicate';

export type GenerationParams = {
  depthMapUrl: string;
  prompt: string;
  negativePrompt: string;
  numOutputs: 2 | 4;
  controlWeight: number;
  roomType: string;
  anonUuid: string;
  strength?: number;       // denoising strength, default 0.8
  guidanceScale?: number;  // cfg scale, default 15
};

// Primary: ControlNet interior-design model — purpose-built for room renders
const PRIMARY_MODEL = 'adirik/interior-design';

// Fallback: standard img2img used previously
const FALLBACK_MODEL =
  'stability-ai/stable-diffusion-img2img:15a3689ee13b0d2616e98820eca31d4c3abcd36672df6afce5cb6feb1d66087d';

export async function generate(params: GenerationParams): Promise<string[]> {
  const provider = (process.env.GENERATION_PROVIDER ?? 'replicate').trim();
  if (provider === 'replicate') {
    return await generateReplicate(params);
  }
  throw new Error(`Unsupported generation provider: ${provider}`);
}

async function generateReplicate(params: GenerationParams): Promise<string[]> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error('Missing REPLICATE_API_TOKEN environment variable.');
  }

  const replicateClient = new Replicate({ auth: token });
  const strength = params.strength ?? 0.8;
  const guidanceScale = params.guidanceScale ?? 15;

  // Try primary model (adirik/interior-design)
  try {
    const output = await replicateClient.run(PRIMARY_MODEL as `${string}/${string}`, {
      input: {
        image: params.depthMapUrl,
        prompt: params.prompt,
        negative_prompt: params.negativePrompt,
        guidance_scale: guidanceScale,
        num_inference_steps: 50,
        prompt_strength: strength,
      },
    });

    if (output) {
      return extractUrls(output);
    }
  } catch (err) {
    console.warn('[adapter] Primary model failed, falling back:', err instanceof Error ? err.message : err);
  }

  // Fallback to stability-ai img2img
  const fallbackOutput = await replicateClient.run(FALLBACK_MODEL as `${string}/${string}:${string}`, {
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
