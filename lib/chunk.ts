export type RawChunk = { source: string; heading: string; text: string };

const MAX_CHARS = 900;

/**
 * Splits a markdown/text document into chunks along headings and paragraphs.
 * Each chunk keeps its nearest heading so retrieval results stay readable.
 */
export function chunkDocument(source: string, content: string): RawChunk[] {
  const chunks: RawChunk[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  let heading = "";
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    buffer = [];
    if (!text) return;
    for (const piece of splitLong(text)) {
      chunks.push({ source, heading, text: piece });
    }
  };

  for (const line of lines) {
    const match = /^#{1,6}\s+(.*)$/.exec(line);
    if (match) {
      flush();
      heading = match[1].trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  return chunks;
}

/** Breaks an over-long section on paragraph boundaries, then on sentences. */
function splitLong(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];

  const units = text
    .split(/\n{2,}/)
    .flatMap((p) => (p.length > MAX_CHARS ? p.split(/(?<=[.!?])\s+/) : [p]));

  const out: string[] = [];
  let current = "";
  for (const unit of units) {
    if (current && current.length + unit.length + 1 > MAX_CHARS) {
      out.push(current.trim());
      current = "";
    }
    current += (current ? " " : "") + unit;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}
