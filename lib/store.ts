import indexJson from "../data/index.json";
import { EMBED_MODEL, embed, hasLlm } from "./llm";

export type Chunk = {
  id: number;
  source: string;
  heading: string;
  text: string;
  embedding?: number[];
};

export type Index = { embedModel: string | null; createdAt: string; chunks: Chunk[] };

export type Hit = { chunk: Chunk; score: number };

const index = indexJson as unknown as Index;

/** Vector search is used only when the index was built with the model in use now. */
export function vectorSearchReady(): boolean {
  return (
    hasLlm() &&
    index.embedModel === EMBED_MODEL &&
    index.chunks.length > 0 &&
    index.chunks.every((c) => Array.isArray(c.embedding))
  );
}

export async function retrieve(question: string, topK = 4): Promise<Hit[]> {
  if (vectorSearchReady()) {
    const [queryVector] = await embed([question]);
    return rank(
      index.chunks.map((chunk) => ({ chunk, score: cosine(queryVector, chunk.embedding!) })),
      topK,
      0.2,
    );
  }
  return keywordSearch(question, topK);
}

function rank(hits: Hit[], topK: number, minScore: number): Hit[] {
  return hits
    .filter((h) => h.score > minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

// --- Keyword fallback (BM25), used when no API key or no embeddings exist ---

const STOPWORDS = new Set(
  "a an and are as at be by can do does for from how i if in is it my of on or that the this to what when where which who will with you your".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((t) => !STOPWORDS.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
}

const K1 = 1.5;
const B = 0.75;

type Bm25 = { docs: Map<string, number>[]; lengths: number[]; avgLength: number; df: Map<string, number> };
let bm25Cache: Bm25 | null = null;

function bm25(): Bm25 {
  if (bm25Cache) return bm25Cache;
  const docs: Map<string, number>[] = [];
  const lengths: number[] = [];
  const df = new Map<string, number>();
  for (const chunk of index.chunks) {
    const tokens = tokenize(`${chunk.heading} ${chunk.text}`);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    docs.push(tf);
    lengths.push(tokens.length);
  }
  const avgLength = lengths.reduce((a, b) => a + b, 0) / Math.max(lengths.length, 1);
  bm25Cache = { docs, lengths, avgLength, df };
  return bm25Cache;
}

function keywordSearch(question: string, topK: number): Hit[] {
  const { docs, lengths, avgLength, df } = bm25();
  const terms = [...new Set(tokenize(question))];
  const total = docs.length;

  const hits = index.chunks.map((chunk, i) => {
    let score = 0;
    for (const term of terms) {
      const tf = docs[i].get(term);
      if (!tf) continue;
      const n = df.get(term) ?? 0;
      const idf = Math.log(1 + (total - n + 0.5) / (n + 0.5));
      score += (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * lengths[i]) / avgLength));
    }
    return { chunk, score };
  });

  return rank(hits, topK, 0);
}

export function indexStats() {
  return {
    chunks: index.chunks.length,
    sources: [...new Set(index.chunks.map((c) => c.source))],
  };
}
