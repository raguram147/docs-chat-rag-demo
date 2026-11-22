"use client";

import { useEffect, useRef, useState } from "react";

type Source = { n: number; source: string; heading: string; text: string; score: number };

type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; sources: Source[]; retrieval?: string; error?: boolean };

const EXAMPLES = [
  "How long do refunds take?",
  "What is the API rate limit?",
  "Can I ship lithium batteries?",
  "How are webhook deliveries retried?",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;

    setInput("");
    setLoading(true);
    setMessages((m) => [...m, { role: "user", text: q }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong.");

      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.answer, sources: data.sources ?? [], retrieval: data.retrieval },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: err instanceof Error ? err.message : "Something went wrong.",
          sources: [],
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="header">
        <h1>Docs Chat</h1>
        <p>
          Ask about the sample Parcelwise documents: shipping, returns and the Tracking API. Every
          answer lists the passages it came from.
        </p>
      </header>

      <section className="thread" aria-live="polite">
        {messages.length === 0 && (
          <div className="examples">
            <p>Try one of these:</p>
            <div className="chips">
              {EXAMPLES.map((example) => (
                <button key={example} type="button" onClick={() => ask(example)}>
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, i) =>
          message.role === "user" ? (
            <div key={i} className="bubble user">
              {message.text}
            </div>
          ) : (
            <div key={i} className={`bubble assistant${message.error ? " error" : ""}`}>
              <p className="answer">{message.text}</p>
              {message.sources.length > 0 && (
                <details className="sources">
                  <summary>
                    {message.sources.length} source{message.sources.length > 1 ? "s" : ""}
                    {message.retrieval ? ` (${message.retrieval} search)` : ""}
                  </summary>
                  <ol>
                    {message.sources.map((s) => (
                      <li key={s.n} value={s.n}>
                        <strong>
                          {s.source}
                          {s.heading ? `: ${s.heading}` : ""}
                        </strong>
                        <span>{s.text}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
          ),
        )}

        {loading && <div className="bubble assistant pending">Searching the documents...</div>}
        <div ref={endRef} />
      </section>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about the documents"
          maxLength={500}
          aria-label="Your question"
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Ask
        </button>
      </form>
    </main>
  );
}
