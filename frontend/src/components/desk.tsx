"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArticlesColumn } from "./articles-column";

const API = "http://localhost:4000";

type Status =
  | "NOVO"
  | "COM_IA"
  | "NA_FILA"
  | "EM_ATENDIMENTO"
  | "AGUARDANDO_CLIENTE"
  | "RESOLVIDO";

type Message = {
  id: number;
  body: string;
  author: string;
  createdAt: string;
};

type Ticket = {
  id: number;
  subject: string;
  status: Status;
  createdAt: string;
  messages: Message[];
};

const statusLabel: Record<Status, string> = {
  NOVO: "Novo",
  COM_IA: "Com a IA",
  NA_FILA: "Na fila",
  EM_ATENDIMENTO: "Em atendimento",
  AGUARDANDO_CLIENTE: "Aguardando cliente",
  RESOLVIDO: "Resolvido",
};

const statusTone: Record<Status, { chip: string; dot: string }> = {
  NOVO: { chip: "bg-[#f3e4cc] text-[#7a4e12]", dot: "bg-[#c47b2b]" },
  COM_IA: { chip: "bg-[#f3e4cc] text-[#7a4e12]", dot: "bg-[#c47b2b]" },
  NA_FILA: { chip: "bg-[#ece7df] text-[#5c564e]", dot: "bg-[#8a8175]" },
  EM_ATENDIMENTO: { chip: "bg-[#e3f0e7] text-[#1d4a34]", dot: "bg-[#2f6f4e]" },
  AGUARDANDO_CLIENTE: { chip: "bg-[#e3eef3] text-[#1e465c]", dot: "bg-[#3d6f8a]" },
  RESOLVIDO: { chip: "bg-[#ece7df] text-[#5c564e]", dot: "bg-[#8a8175]" },
};

function StatusMark({ status }: { status: Status }) {
  const tone = statusTone[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] ${tone.chip}`}
    >
      <span className={`size-1.5 rounded-full ${tone.dot}`} />
      {statusLabel[status]}
    </span>
  );
}

const filters = ["Abertos", "Novos", "Resolvidos", "Todos"] as const;
type Filter = (typeof filters)[number];

function matches(ticket: Ticket, filter: Filter) {
  if (filter === "Todos") return true;
  if (filter === "Resolvidos") return ticket.status === "RESOLVIDO";
  if (filter === "Novos") return ticket.status === "NOVO";
  return ticket.status !== "RESOLVIDO";
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalize(ticket: Ticket): Ticket {
  return {
    ...ticket,
    messages: [...ticket.messages].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
        a.id - b.id,
    ),
  };
}

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

export function Desk() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("Abertos");
  const [draft, setDraft] = useState("");
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [opening, setOpening] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api<Ticket[]>("/tickets")
      .then((data) => {
        if (cancelled) return;
        const next = data.map(normalize);
        setTickets(next);
        const first =
          next.find((ticket) => ticket.status !== "RESOLVIDO") ?? next[0];
        setSelectedId(first?.id ?? null);
      })
      .catch((caught: Error) => {
        if (!cancelled) setError(caught.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => tickets.filter((ticket) => matches(ticket, filter)),
    [tickets, filter],
  );
  const selected =
    visible.find((ticket) => ticket.id === selectedId) ?? visible[0] ?? null;

  function select(id: number) {
    setSelectedId(id);
    setComposing(false);
    setDraft("");
    setError("");
  }

  function replace(ticket: Ticket) {
    const next = normalize(ticket);
    setTickets((current) => {
      const exists = current.some((item) => item.id === next.id);
      const list = exists
        ? current.map((item) => (item.id === next.id ? next : item))
        : [next, ...current];
      return list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    });
    setSelectedId(next.id);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível falar com o servidor.",
      );
    } finally {
      setBusy(false);
    }
  }

  function sendReply(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !selected || busy) return;
    void run(async () => {
      const ticket = await api<Ticket>(`/tickets/${selected.id}/reply`, {
        method: "POST",
        body: JSON.stringify({ message: body }),
      });
      replace(ticket);
      setDraft("");
    });
  }

  function openTicket(event: FormEvent) {
    event.preventDefault();
    const nextSubject = subject.trim();
    const nextBody = opening.trim();
    if (!nextSubject || !nextBody || busy) return;
    void run(async () => {
      const ticket = await api<Ticket>("/tickets", {
        method: "POST",
        body: JSON.stringify({ subject: nextSubject, message: nextBody }),
      });
      replace(ticket);
      setFilter("Novos");
      setSubject("");
      setOpening("");
      setComposing(false);
    });
  }

  function assume() {
    if (!selected || busy) return;
    void run(async () => {
      const ticket = await api<Ticket>(`/tickets/${selected.id}/assume`, {
        method: "POST",
      });
      replace(ticket);
      setFilter("Abertos");
    });
  }

  function resolve() {
    if (!selected || busy) return;
    void run(async () => {
      const ticket = await api<Ticket>(`/tickets/${selected.id}/resolve`, {
        method: "POST",
      });
      replace(ticket);
      setFilter("Resolvidos");
    });
  }

  return (
    <div className="grid h-screen grid-cols-[300px_1fr_320px] bg-paper text-ink">
      <aside className="flex min-h-0 flex-col bg-rail text-rail-ink">
        <div className="flex items-center justify-between px-4 pb-3 pt-5">
          <h1 className="font-serif text-[26px] leading-none">HelpDesk</h1>
          <button
            type="button"
            onClick={() => {
              setComposing(true);
              setDraft("");
              setError("");
            }}
            className="rounded-md bg-[#efe8dc] px-2.5 py-1 text-[13px] text-ink hover:bg-white"
          >
            Novo
          </button>
        </div>

        <div className="flex gap-1 px-3 pb-3 text-[13px]">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={
                item === filter
                  ? "rounded-md bg-[#efe8dc] px-2 py-1 text-ink"
                  : "rounded-md px-2 py-1 text-[#c8bfb2] hover:text-rail-ink"
              }
            >
              {item}
            </button>
          ))}
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <li className="px-4 py-6 text-sm text-[#c8bfb2]">
              Carregando a fila.
            </li>
          ) : visible.length === 0 ? (
            <li className="px-4 py-6 text-sm text-[#c8bfb2]">
              Nada nesta fila.
            </li>
          ) : (
            visible.map((ticket) => {
              const active = selected?.id === ticket.id && !composing;
              return (
                <li key={ticket.id} className="px-2">
                  <button
                    type="button"
                    onClick={() => select(ticket.id)}
                    className={`block w-full rounded-md px-3 py-2.5 text-left ${
                      active ? "bg-[#31423a]" : "hover:bg-[#2b3a33]"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3 text-[12px] text-[#c8bfb2]">
                      <span className="truncate">
                        {formatWhen(ticket.createdAt)}
                      </span>
                      <span className="shrink-0">#{ticket.id}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[15px] text-rail-ink">
                      {ticket.subject}
                    </span>
                    <span className="mt-1.5 block">
                      <StatusMark status={ticket.status} />
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      <main className="flex min-h-0 flex-col">
        {composing ? (
          <form onSubmit={openTicket} className="flex min-h-0 flex-1 flex-col">
            <header className="border-b border-line px-8 py-5">
              <p className="text-[13px] text-muted">Novo chamado</p>
              <h2 className="mt-1 font-serif text-[30px] leading-tight">
                O que aconteceu?
              </h2>
            </header>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-8 py-5">
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Assunto"
                className="rounded-md border border-line bg-white px-4 py-3 font-serif text-2xl outline-none placeholder:text-[#b7ad9f]"
              />
              <textarea
                value={opening}
                onChange={(event) => setOpening(event.target.value)}
                placeholder="Descreva o problema com o que você já tentou."
                className="min-h-40 flex-1 resize-none rounded-md border border-line bg-white px-4 py-3 text-[15px] leading-6 outline-none placeholder:text-[#b7ad9f]"
              />
            </div>
            <div className="border-t border-line bg-[#ebe4d8] px-6 py-3">
              {error ? <p className="mb-2 text-sm text-mark">{error}</p> : null}
              <div className="flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setComposing(false);
                    setError("");
                  }}
                  className="text-sm text-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-ink px-3 py-1.5 text-sm text-paper disabled:opacity-50"
                >
                  Abrir chamado
                </button>
              </div>
            </div>
          </form>
        ) : selected ? (
          <>
            <header className="flex items-start justify-between gap-6 border-b border-line px-8 py-5">
              <div className="min-w-0">
                <p className="text-[13px] text-muted">
                  #{selected.id} · aberto {formatWhen(selected.createdAt)}
                </p>
                <h2 className="mt-1 truncate font-serif text-[30px] leading-tight">
                  {selected.subject}
                </h2>
              </div>
              <StatusMark status={selected.status} />
            </header>

            <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto px-8 py-5">
              {selected.messages.map((message) => {
                const fromAgent = message.author === "atendente";
                return (
                  <li
                    key={message.id}
                    className={
                      fromAgent
                        ? "max-w-2xl rounded-md border border-[#d5e3d9] bg-[#f4f8f5] px-4 py-3"
                        : "max-w-2xl rounded-md border border-line bg-white px-4 py-3"
                    }
                  >
                    <p className="text-[12px] text-muted">
                      {fromAgent ? "Atendente" : "Cliente"} ·{" "}
                      {formatWhen(message.createdAt)}
                    </p>
                    <p className="mt-1 text-[15px] leading-6">{message.body}</p>
                  </li>
                );
              })}
            </ol>

            <DeskAction
              status={selected.status}
              draft={draft}
              busy={busy}
              error={error}
              onDraft={setDraft}
              onReply={sendReply}
              onAssume={assume}
              onResolve={resolve}
            />
          </>
        ) : (
          <p className="px-8 py-10 text-muted">
            {loading
              ? "Carregando a fila."
              : error || "Escolha um chamado na fila."}
          </p>
        )}
      </main>
      <ArticlesColumn />
    </div>
  );
}

function DeskAction({
  status,
  draft,
  busy,
  error,
  onDraft,
  onReply,
  onAssume,
  onResolve,
}: {
  status: Status;
  draft: string;
  busy: boolean;
  error: string;
  onDraft: (value: string) => void;
  onReply: (event: FormEvent) => void;
  onAssume: () => void;
  onResolve: () => void;
}) {
  if (status === "RESOLVIDO") {
    return (
      <div className="border-t border-line bg-[#ebe4d8] px-8 py-4 text-sm text-muted">
        Este chamado está encerrado. O histórico fica aqui.
      </div>
    );
  }

  if (status === "NOVO") {
    return (
      <div className="flex items-center justify-between gap-4 border-t border-line bg-[#ebe4d8] px-6 py-3">
        <p className="text-sm text-muted">
          Este chamado ainda não foi assumido.
          {error ? <span className="mt-1 block text-mark">{error}</span> : null}
        </p>
        <button
          type="button"
          onClick={onAssume}
          disabled={busy}
          className="rounded-md bg-ink px-3 py-1.5 text-sm text-paper disabled:opacity-50"
        >
          Assumir
        </button>
      </div>
    );
  }

  if (status === "EM_ATENDIMENTO") {
    return (
      <form
        onSubmit={onReply}
        className="border-t border-line bg-[#ebe4d8] px-6 py-3"
      >
        {error ? <p className="mb-2 text-sm text-mark">{error}</p> : null}
        <div className="flex items-end gap-3 rounded-md border border-[#cfc4b2] bg-white px-3 py-2">
          <textarea
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            placeholder="Escreva a resposta"
            rows={2}
            className="max-h-28 min-h-12 flex-1 resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-[#b7ad9f]"
          />
          <button
            type="button"
            onClick={onResolve}
            disabled={busy}
            className="mb-0.5 shrink-0 text-sm text-muted disabled:opacity-50"
          >
            Resolver
          </button>
          <button
            type="submit"
            disabled={busy}
            className="mb-0.5 shrink-0 rounded-md bg-ink px-3 py-1.5 text-sm text-paper disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </form>
    );
  }

  if (status === "AGUARDANDO_CLIENTE") {
    return (
      <div className="flex items-center justify-between gap-4 border-t border-line bg-[#ebe4d8] px-6 py-3">
        <p className="text-sm text-muted">
          Aguardando o cliente. A resposta do atendente já foi enviada.
          {error ? <span className="mt-1 block text-mark">{error}</span> : null}
        </p>
        <button
          type="button"
          onClick={onResolve}
          disabled={busy}
          className="rounded-md bg-ink px-3 py-1.5 text-sm text-paper disabled:opacity-50"
        >
          Resolver
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-line bg-[#ebe4d8] px-8 py-4 text-sm text-muted">
      Esse status ainda não tem ação na mesa.
    </div>
  );
}
