# Docs Chat: a RAG chatbot with source citations

Ask questions about a set of documents and get short answers that cite the passages they came from. Built with Next.js and TypeScript, with no vector database to run.

The sample data in `docs/` belongs to Parcelwise, a fictional courier software company.

## How it works

1. `npm run ingest` reads every `.md` and `.txt` file in `docs/`, splits it into chunks along headings, embeds the chunks, and writes `data/index.json`.
2. `POST /api/chat` embeds the question, ranks chunks by cosine similarity, and sends the top four to the chat model with instructions to answer only from them and cite them.
3. The UI shows the answer and the passages behind it.

Other details:

- **Works without an API key.** With no `OPENAI_API_KEY`, ingest stores text only and the app uses BM25 keyword search, returning the best passages instead of a written answer.
- **Any OpenAI-compatible provider.** Set `OPENAI_BASE_URL` to point at a LiteLLM gateway or another compatible endpoint.
- **Guard rails for a public demo.** Per-client rate limit (10 questions a minute), a 500-character question limit, request timeouts, and a prompt that treats document text as reference material and not as instructions.

## Run it locally

Requires Node.js 20.12 or newer.

```bash
npm install
cp .env.example .env.local   # add your OPENAI_API_KEY
npm run ingest
npm run dev
```

Open http://localhost:3000.

## Use your own documents

Replace the files in `docs/` with your own `.md` or `.txt` files, then run `npm run ingest` again. Re-run ingest whenever the documents or `EMBED_MODEL` change. The app falls back to keyword search if the index was built with a different embedding model.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | none | Enables embeddings and written answers |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint |
| `CHAT_MODEL` | `gpt-4o-mini` | Model that writes the answer |
| `EMBED_MODEL` | `text-embedding-3-small` | Model that embeds chunks and questions |

Model names change over time, so check your provider's current list.

## Deploy

The app is a standard Next.js project and deploys to any Next.js host. Commit `data/index.json` (built with your key) so the index ships with the app, and set the environment variables in the host's dashboard.

## Limits

- The whole index is loaded in memory, which suits up to a few thousand chunks. Beyond that, move to pgvector or a hosted vector store.
- The rate limiter is per server instance. Use Redis or your host's rate limiting for real traffic.
- Each question is answered on its own, with no conversation memory.

## Project layout

```
app/page.tsx            Chat UI
app/api/chat/route.ts   Retrieval and answer endpoint
lib/chunk.ts            Document chunking
lib/store.ts            Vector search and BM25 fallback
lib/llm.ts              OpenAI-compatible client
lib/rate-limit.ts       Request limiter
scripts/ingest.ts       Index builder
docs/                   Source documents
data/index.json         Generated index
```
