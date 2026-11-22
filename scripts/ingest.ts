/**
 * Builds data/index.json from the files in docs/.
 * With OPENAI_API_KEY set it stores embeddings for vector search;
 * without one it stores text only and the app uses keyword search.
 *
 * Usage: npm run ingest
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // The file is optional.
  }
}

const DOCS_DIR = path.join(process.cwd(), "docs");
const OUT_FILE = path.join(process.cwd(), "data", "index.json");
const BATCH_SIZE = 64;

async function main() {
  // Imported after the env files load, because lib/llm reads env at import time.
  const { chunkDocument } = await import("../lib/chunk");
  const { EMBED_MODEL, embed, hasLlm } = await import("../lib/llm");

  const files = (await readdir(DOCS_DIR)).filter((f) => /\.(md|txt)$/i.test(f)).sort();
  if (files.length === 0) {
    throw new Error(`No .md or .txt files found in ${DOCS_DIR}`);
  }

  const raw = [];
  for (const file of files) {
    const content = await readFile(path.join(DOCS_DIR, file), "utf8");
    raw.push(...chunkDocument(file, content));
  }

  let embeddings: number[][] | null = null;
  if (hasLlm()) {
    embeddings = [];
    for (let i = 0; i < raw.length; i += BATCH_SIZE) {
      const batch = raw.slice(i, i + BATCH_SIZE);
      embeddings.push(...(await embed(batch.map((c) => `${c.heading}\n${c.text}`))));
      console.log(`Embedded ${Math.min(i + BATCH_SIZE, raw.length)}/${raw.length} chunks`);
    }
  }

  const index = {
    embedModel: embeddings ? EMBED_MODEL : null,
    createdAt: new Date().toISOString(),
    chunks: raw.map((chunk, i) => ({
      id: i + 1,
      ...chunk,
      ...(embeddings ? { embedding: embeddings[i] } : {}),
    })),
  };

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(index));

  console.log(
    `Indexed ${index.chunks.length} chunks from ${files.length} files ` +
      (embeddings ? `with ${EMBED_MODEL} embeddings.` : "in keyword mode (no OPENAI_API_KEY set)."),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
