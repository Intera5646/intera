import Groq from 'groq-sdk';

let groqClient: Groq | null = null;

function getGroq(): Groq {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

export interface DesignerText {
  furniture_placement: string;
  color_solution: string;
  lighting: string;
  style_explanation: string;
  budget_range: {
    min: number;
    max: number;
    currency: string;
    description: string;
  };
  shopping_highlights: Array<{
    category: string;
    item: string;
    price_range: string;
  }>;
}

const ROOM_LABELS: Record<string, string> = {
  living_room: 'гостиная',
  bedroom: 'спальня',
  kitchen: 'кухня',
  bathroom: 'ванная комната',
  office: 'рабочий кабинет',
  balcony: 'балкон / лоджия',
};

const BUDGET_RANGES: Record<string, { min: number; max: number }> = {
  'Эконом': { min: 250000, max: 700000 },
  'Средний': { min: 700000, max: 2000000 },
  'Премиум': { min: 2000000, max: 6000000 },
};

export async function generateDesignerText(params: {
  roomType: string;
  style: string;
  budget: string;
  wishes?: string;
}): Promise<DesignerText> {
  const roomLabel = ROOM_LABELS[params.roomType] ?? params.roomType;
  const range = BUDGET_RANGES[params.budget] ?? { min: 500000, max: 1500000 };

  const wishesClause = params.wishes?.trim()
    ? `\nПожелания клиента: ${params.wishes.slice(0, 300)}`
    : '';

  const systemPrompt =
    'Ты — профессиональный дизайнер интерьеров в России. Отвечаешь кратко, конкретно и по-русски. Только JSON, никакого лишнего текста.';

  const userPrompt = `Опиши дизайн-решение для помещения: ${roomLabel}.
Стиль: "${params.style}". Бюджет: "${params.budget}".${wishesClause}

Верни ровно такой JSON (без markdown, без пояснений):
{
  "furniture_placement": "2-3 предложения о расстановке мебели и функциональных зонах",
  "color_solution": "2-3 предложения о цветовой палитре и сочетаниях",
  "lighting": "2-3 предложения о сценариях освещения и типах светильников",
  "style_explanation": "2-3 предложения об атмосфере и характере стиля",
  "budget_range": {
    "min": ${range.min},
    "max": ${range.max},
    "currency": "RUB",
    "description": "краткое описание: что входит в бюджет данного сегмента"
  },
  "shopping_highlights": [
    {"category": "Диван / кровать", "item": "название главного предмета мебели", "price_range": "от X до Y ₽"},
    {"category": "Освещение", "item": "тип светильника", "price_range": "от X до Y ₽"},
    {"category": "Напольное покрытие", "item": "материал", "price_range": "от X до Y ₽/м²"},
    {"category": "Декор", "item": "ключевые декоративные элементы", "price_range": "от X до Y ₽"}
  ]
}`;

  const completion = await getGroq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.65,
    max_tokens: 900,
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  return JSON.parse(content) as DesignerText;
}

// ── Two-stage design brief ────────────────────────────────────────────────────

export interface DesignBrief {
  concept: string;
  materials: {
    floor: string;
    walls: string;
    ceiling: string;
    furniture: string;
    accents: string;
  };
  furniture_layout: string;
  lighting: string;
  color_palette: string[];
  personalization_notes: string;
  sd_prompt: string;
  sd_negative_prompt: string;
  report_sections: {
    concept_description: string;
    materials_description: string;
    layout_description: string;
    lighting_description: string;
    personalization_description: string;
    budget_notes: string;
    implementation_tips: string;
  };
}

const BRIEF_SYSTEM_PROMPT = `You are a professional Russian interior designer with 15 years of experience. You create detailed, realistic, and personalized design briefs. Always respond in valid JSON only, no other text.

Given the room parameters, create a complete design brief with this exact JSON structure:
{
  "concept": "One sentence describing the overall design concept in Russian",
  "materials": {
    "floor": "exact material, finish, color in Russian",
    "walls": "exact material, texture, color in Russian",
    "ceiling": "material and height treatment in Russian",
    "furniture": "main furniture materials and fabrics in Russian",
    "accents": "decorative elements, plants, textiles in Russian"
  },
  "furniture_layout": "Detailed description of furniture placement in Russian, mention specific pieces and their positions",
  "lighting": "Lighting scheme: main light, accent lights, natural light in Russian",
  "color_palette": ["hex1", "hex2", "hex3", "hex4"],
  "personalization_notes": "How the design accounts for residents, pets, workspace needs in Russian",
  "sd_prompt": "ENGLISH ONLY: photorealistic interior design render, [style] style, [room type], [floor material], [wall material], [specific furniture with placement], [lighting description], [color palette], [decorative details], professional interior photography, shot on Canon EOS R5 24mm f/2.8, 8K resolution, high detail, architectural visualization, warm ambient lighting, realistic materials and textures",
  "sd_negative_prompt": "ENGLISH ONLY: cartoon, illustration, unrealistic, blurry, low quality, distorted furniture, floating objects, bad proportions, watermark, text",
  "report_sections": {
    "concept_description": "2-3 sentences about the concept in Russian",
    "materials_description": "Detailed materials explanation in Russian",
    "layout_description": "Furniture arrangement rationale in Russian",
    "lighting_description": "Lighting design explanation in Russian",
    "personalization_description": "How design fits the specific residents in Russian",
    "budget_notes": "What to prioritize in this budget segment in Russian",
    "implementation_tips": "3 practical tips for implementation in Russian"
  }
}`;

export async function buildDesignBrief(params: {
  roomType: string;
  style: string;
  budget: string;
  ceilingHeight: number;
  apartmentType?: string;
  uploadType?: string;
  residents?: string | null;
  hasPets?: string | null;
  needsWorkspace?: string | null;
  lightingPreference?: string | null;
  dislikedColors?: string | null;
  wishes?: string;
}): Promise<DesignBrief> {
  const roomLabel = ROOM_LABELS[params.roomType] ?? params.roomType;

  const lines: string[] = [
    `Тип помещения: ${roomLabel}`,
    `Стиль: ${params.style}`,
    `Бюджет: ${params.budget}`,
    `Высота потолков: ${params.ceilingHeight} мм`,
  ];
  if (params.apartmentType) lines.push(`Тип квартиры: ${params.apartmentType}`);
  if (params.uploadType) lines.push(`Тип входных данных: ${params.uploadType}`);
  if (params.residents) lines.push(`Количество проживающих: ${params.residents}`);
  if (params.hasPets) lines.push(`Домашние животные: ${params.hasPets}`);
  if (params.needsWorkspace) lines.push(`Рабочее место: ${params.needsWorkspace}`);
  if (params.lightingPreference) lines.push(`Предпочтения по освещению: ${params.lightingPreference}`);
  if (params.dislikedColors) lines.push(`Нежелательные цвета: ${params.dislikedColors}`);
  if (params.wishes?.trim()) lines.push(`Пожелания клиента: ${params.wishes.slice(0, 400)}`);

  const userPrompt = `Создай дизайн-бриф для следующего проекта:\n\n${lines.join('\n')}`;

  const attemptParse = async (prompt: string): Promise<DesignBrief> => {
    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: BRIEF_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
      max_tokens: 1800,
    });
    const content = completion.choices[0]?.message?.content ?? '{}';
    return JSON.parse(content) as DesignBrief;
  };

  try {
    const brief = await attemptParse(userPrompt);
    console.log('[buildDesignBrief] Success, sd_prompt length:', brief.sd_prompt?.length ?? 0);
    return brief;
  } catch (firstErr) {
    console.warn('[buildDesignBrief] First attempt failed, retrying:', firstErr);
    try {
      const simplePrompt = `Создай дизайн-бриф. Стиль: ${params.style}. Помещение: ${roomLabel}. Бюджет: ${params.budget}.`;
      const brief = await attemptParse(simplePrompt);
      console.log('[buildDesignBrief] Retry succeeded');
      return brief;
    } catch (secondErr) {
      console.error('[buildDesignBrief] Both attempts failed:', secondErr);
      throw secondErr;
    }
  }
}

export function buildFallbackPrompt(params: { roomType: string; style: string; budget: string }): {
  sdPrompt: string;
  sdNegativePrompt: string;
} {
  const roomLabelsEn: Record<string, string> = {
    living_room: 'living room',
    bedroom: 'bedroom',
    kitchen: 'kitchen with dining area',
    bathroom: 'bathroom',
    office: 'home office',
    balcony: 'balcony terrace',
    studio: 'studio apartment',
  };
  const room = roomLabelsEn[params.roomType] ?? params.roomType;
  return {
    sdPrompt: `photorealistic interior design render, ${params.style} style, ${room}, professional interior photography, shot on Canon EOS R5, 8K resolution, architectural visualization, warm ambient lighting, realistic materials`,
    sdNegativePrompt:
      'cartoon, illustration, unrealistic, blurry, low quality, distorted furniture, floating objects, bad proportions, watermark, text',
  };
}

export function formatReportText(sections: DesignBrief['report_sections']): string {
  return [
    `🎨 Концепция\n${sections.concept_description}`,
    `🪵 Материалы\n${sections.materials_description}`,
    `🛋 Расстановка мебели\n${sections.layout_description}`,
    `💡 Освещение\n${sections.lighting_description}`,
    `👥 Персонализация\n${sections.personalization_description}`,
    `💰 Бюджет\n${sections.budget_notes}`,
    `✅ Советы по реализации\n${sections.implementation_tips}`,
  ].join('\n\n');
}

// ── Legacy prompt builder (kept for compatibility) ────────────────────────────

export async function buildGenerationPrompt(params: {
  roomType: string;
  style: string;
  budget: string;
  wishes?: string;
}): Promise<{ prompt: string; negativePrompt: string }> {
  const roomLabelsEn: Record<string, string> = {
    living_room: 'living room',
    bedroom: 'bedroom',
    kitchen: 'kitchen with dining area',
    bathroom: 'bathroom',
    office: 'home office',
    balcony: 'balcony terrace',
  };

  const styleMap: Record<string, string> = {
    'Скандинавский': 'Scandinavian style, light birch wood, white walls, hygge cozy atmosphere, natural linen textures, indoor plants',
    'Минимализм': 'minimalist style, clean geometric lines, neutral palette, hidden storage, generous negative space',
    'Лофт': 'loft industrial style, exposed brick, raw concrete, dark metal frames, Edison vintage bulbs',
    'Классика': 'classical elegant style, crown moldings, warm cream tones, upholstered traditional furniture, parquet floors',
    'Современный': 'modern contemporary style, sleek matte surfaces, bold accent colors, brushed metal, glass',
  };

  const budgetMap: Record<string, string> = {
    'Эконом': 'budget materials, IKEA furniture, laminate flooring, white painted walls, LED lighting',
    'Средний': 'mid-range quality furniture, engineered hardwood, quality tiles, stylish pendant lights',
    'Премиум': 'luxury designer furniture, natural stone, venetian plaster, Flos architectural lighting, premium finishes',
  };

  const room = roomLabelsEn[params.roomType] ?? params.roomType;
  const stylePart = styleMap[params.style] ?? params.style;
  const budgetPart = budgetMap[params.budget] ?? params.budget;
  const wishesPart = params.wishes?.trim()
    ? `, ${params.wishes.slice(0, 150)}`
    : '';

  const prompt = `photorealistic interior photograph, ${room}, ${stylePart}, ${budgetPart}${wishesPart}, 8k resolution, soft natural light, professional architectural photography, cinematic depth of field, no people`;

  const negativePrompt =
    'bad geometry, distorted walls, warped perspective, cartoon, anime, watermark, text overlay, low quality, blurry, oversaturated, people, faces, ugly, deformed, extra rooms, surreal';

  return { prompt, negativePrompt };
}
