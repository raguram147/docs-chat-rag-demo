/**
 * Thin client for any OpenAI-compatible API (OpenAI, a LiteLLM gateway, etc.).
 * Plain fetch keeps the demo dependency-free and easy to point at another provider.
 */

const BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
export const CHAT_MODEL = process.env.CHAT_MODEL ?? "gpt-4o-mini";
export const EMBED_MODEL = process.env.EMBED_MODEL ?? "text-embedding-3-small";

const TIMEOUT_MS = 30_000;

export function hasLlm(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`LLM API ${path} failed with ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

export async function embed(texts: string[]): Promise<number[][]> {
  const data = await post<{ data: { index: number; embedding: number[] }[] }>("/embeddings", {
    model: EMBED_MODEL,
    input: texts,
  });
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chat(messages: ChatMessage[]): Promise<string> {
  const data = await post<{ choices: { message: { content: string | null } }[] }>(
    "/chat/completions",
    { model: CHAT_MODEL, messages, temperature: 0.1 },
  );
  return data.choices[0]?.message?.content?.trim() ?? "";
}
