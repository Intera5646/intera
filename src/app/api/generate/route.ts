import { NextRequest, NextResponse } from "next/server";
import {
  STYLE_PROMPTS,
  ROOM_PROMPTS,
  BUDGET_PROMPTS,
} from "@/lib/data/zones_index";

export async function POST(req: NextRequest) {
  const { style, room, budget } = await req.json();

  if (!style || !room || !budget) {
    return NextResponse.json(
      { error: "style, room, and budget are required" },
      { status: 400 }
    );
  }

  const stylePrompt = STYLE_PROMPTS[style];
  const roomPrompt = ROOM_PROMPTS[room];
  const budgetPrompt = BUDGET_PROMPTS[budget];

  if (!stylePrompt || !roomPrompt || !budgetPrompt) {
    return NextResponse.json(
      { error: "Invalid style, room, or budget value" },
      { status: 400 }
    );
  }

  const prompt = `A high-quality photorealistic interior design render of a ${roomPrompt}, styled as ${stylePrompt}, with ${budgetPrompt}.`;

  return NextResponse.json({ prompt });
}
