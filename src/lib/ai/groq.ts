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
