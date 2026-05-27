import Replicate from 'replicate';

export type GenerationParams = {
  depthMapUrl: string;
  prompt: string;
  negativePrompt: string;
  numOutputs: 2 | 4;
  controlWeight: number;
  roomType: string;
  anonUuid: string;
  strength?: number;       // prompt_strength for img2img, default 0.75
  guidanceScale?: number;  // cfg scale, default 12
};

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

  const prompt = `${params.prompt} ${params.roomType} interior, photorealistic, cinematic lighting, soft textures`;
  const negativePrompt = params.negativePrompt;

  const output = await replicateClient.run('stability-ai/stable-diffusion-img2img:15a3689ee13b0d2616e98820eca31d4c3abcd36672df6afce5cb6feb1d66087d', {
    input: {
      image: params.depthMapUrl,
      prompt,
      negative_prompt: negativePrompt,
      guidance_scale: params.guidanceScale ?? 12,
      prompt_strength: params.strength ?? 0.75,
      num_inference_steps: 20,
      num_outputs: 1,
    },
  });

  if (!output) {
    throw new Error('Generation provider returned no output.');
  }

  const items = Array.isArray(output) ? output : [output];
  return items.map((item: unknown) => {
    if (typeof item === 'string') return item;
    const obj = item as Record<string, unknown>;
    if (typeof obj?.url === 'function') return (obj.url as () => string)();
    if (typeof obj?.url === 'string') return obj.url;
    return String(item);
  });
}
