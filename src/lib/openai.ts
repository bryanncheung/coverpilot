import OpenAI from "openai";

export const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

export function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY?.trim(),
  });
}
