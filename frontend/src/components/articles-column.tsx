"use client";

import { FormEvent, useEffect, useState } from "react";

const API = "http://localhost:4000";

type Article = {
  id: number;
  title: string;
  body: string;
  published: boolean;
  createdAt: string;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = payload?.message;
    throw new Error(
      Array.isArray(message)
        ? message.join(" ")
        : message || "Não foi possível falar com o servidor.",
    );
  }
  return response.json() as Promise<T>;
}

export function ArticlesColumn() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api<Article[]>("/articles?all=1");
    setArticles(data);
  }

  useEffect(() => {
    load().catch((caught: Error) => setError(caught.message));
  }, []);

  async function createArticle(event: FormEvent) {
    event.preventDefault();
    const nextTitle = title.trim();
    const nextBody = body.trim();
    if (!nextTitle || !nextBody || busy) return;

    setBusy(true);
    setError("");
    try {
      const created = await api<Article>("/articles", {
        method: "POST",
        body: JSON.stringify({ title: nextTitle, body: nextBody }),
      });
      setArticles((current) => [created, ...current]);
      setTitle("");
      setBody("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível criar o artigo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggle(article: Article) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const path = article.published
        ? `/articles/${article.id}/unpublish`
        : `/articles/${article.id}/publish`;
      const next = await api<Article>(path, { method: "POST" });
      setArticles((current) =>
        current.map((item) => (item.id === next.id ? next : item)),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível atualizar o artigo.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="flex min-h-0 flex-col border-l border-line bg-paper">
      <header className="border-b border-line px-4 py-5">
        <h2 className="font-serif text-[22px] leading-none">Base</h2>
        <p className="mt-2 text-[13px] text-muted">
          A IA só lê o que estiver publicado.
        </p>
      </header>

      <ul className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {articles.length === 0 ? (
          <li className="px-1 py-3 text-sm text-muted">Nenhum artigo ainda.</li>
        ) : (
          articles.map((article) => (
            <li key={article.id} className="border-b border-line px-1 py-3">
              <p className="text-[15px]">{article.title}</p>
              <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted">
                {article.body}
              </p>
              <button
                type="button"
                onClick={() => toggle(article)}
                disabled={busy}
                className="mt-2 text-[13px] text-ink disabled:opacity-50"
              >
                {article.published ? "Despublicar" : "Republicar"}
              </button>
            </li>
          ))
        )}
      </ul>

      <form
        onSubmit={createArticle}
        className="border-t border-line bg-[#ebe4d8] px-3 py-3"
      >
        {error ? <p className="mb-2 text-sm text-mark">{error}</p> : null}
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Título"
          className="w-full rounded-md border border-[#cfc4b2] bg-white px-3 py-2 text-sm outline-none"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Texto do artigo"
          rows={3}
          className="mt-2 w-full resize-none rounded-md border border-[#cfc4b2] bg-white px-3 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-md bg-ink px-3 py-1.5 text-sm text-paper disabled:opacity-50"
        >
          Guardar artigo
        </button>
      </form>
    </aside>
  );
}
