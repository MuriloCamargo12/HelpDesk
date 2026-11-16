"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArticlesColumn } from "./articles-column";
import {
  AppSkeleton,
  MetricValueSkeleton,
  QueueSkeleton,
  TicketPaneSkeleton,
} from "./skeleton";
import { api } from "../lib/api";
import { clearSession, readSession, type Session } from "../lib/session";

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

type Metrics = {
  open: number;
  answeredByAi: number;
  handledByPerson: number;
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
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] ${tone.chip}`}
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

export function Desk() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
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
  const [pane, setPane] = useState<"fila" | "chamado" | "base">("fila");
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace("/login");
      return;
    }
    if (current.user.role !== "ATENDENTE") {
      router.replace("/cliente");
      return;
    }
    setSession(current);
    setChecked(true);
  }, [router]);

  useEffect(() => {
    if (!checked) return;
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
  }, [checked]);

  function loadMetrics() {
    api<Metrics>("/tickets/metrics")
      .then(setMetrics)
      .catch(() => setMetrics(null));
  }

  useEffect(() => {
    if (!checked) return;
    loadMetrics();
  }, [checked]);

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
    setPane("chamado");
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
    loadMetrics();
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

  function suggest() {
    if (!selected || busy) return;
    void run(async () => {
      const result = await api<{ draft: string }>(
        `/tickets/${selected.id}/suggest`,
        { method: "POST" },
      );
      setDraft(result.draft);
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
      setFilter("Abertos");
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

  function logout() {
    clearSession();
    router.replace("/login");
  }

  const panes = [
    ["fila", "Fila"],
    ["chamado", "Chamado"],
    ["base", "Base"],
  ] as const;

  if (!checked || !session) {
    return <AppSkeleton articles />;
  }

  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden bg-paper text-ink">
      <nav className="grid shrink-0 grid-cols-3 gap-1 bg-rail p-2 lg:hidden">
        {panes.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPane(id)}
            className={
              pane === id
                ? "cursor-pointer rounded-md bg-[#efe8dc] px-2 py-1.5 text-[13px] text-ink"
                : "cursor-pointer rounded-md px-2 py-1.5 text-[13px] text-[#c8bfb2] transition-colors hover:bg-[#31423a] hover:text-rail-ink"
            }
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="grid min-h-0 w-full min-w-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)_minmax(240px,320px)]">
      <aside
        className={`${pane === "fila" ? "flex" : "hidden"} min-h-0 min-w-0 flex-col overflow-hidden bg-rail text-rail-ink lg:flex`}
      >
        <div className="flex min-h-28 shrink-0 flex-col justify-center border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="min-w-0 truncate font-serif text-[26px] leading-none">
              HelpDesk
            </h1>
            <button
              type="button"
              onClick={() => {
                setComposing(true);
                setDraft("");
                setError("");
                setPane("chamado");
              }}
              className="shrink-0 cursor-pointer rounded-md bg-[#efe8dc] px-2.5 py-1 text-[13px] text-ink transition-colors hover:bg-white"
            >
              Novo
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-[13px] text-[#c8bfb2]">
            <span className="truncate">{session.user.name}</span>
            <button
              type="button"
              onClick={logout}
              className="shrink-0 cursor-pointer rounded-md border border-white/30 px-2.5 py-1 text-rail-ink transition-colors hover:bg-white/10"
            >
              Sair
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1 text-[13px]">
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={
                  item === filter
                    ? "cursor-pointer rounded-md bg-[#efe8dc] px-1.5 py-1 text-ink transition-colors hover:bg-white"
                    : "cursor-pointer rounded-md px-1.5 py-1 text-[#c8bfb2] transition-colors hover:bg-[#31423a] hover:text-rail-ink"
                }
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <dl className="shrink-0 space-y-1 border-b border-white/10 px-4 py-3 text-[13px]">
          {(
            [
              ["Abertos", metrics?.open],
              ["Respondidos pela IA", metrics?.answeredByAi],
              ["Atendidos por uma pessoa", metrics?.handledByPerson],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <dt className="text-[#c8bfb2]">{label}</dt>
              <dd className="shrink-0 text-rail-ink">
                {loading && value == null ? <MetricValueSkeleton /> : (value ?? "–")}
              </dd>
            </div>
          ))}
        </dl>

        <ul className="min-h-0 flex-1 overflow-y-auto pt-3">
          {loading ? (
            <QueueSkeleton />
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
                    className={`block w-full min-w-0 cursor-pointer overflow-hidden rounded-md px-3 py-2.5 text-left ${
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

      <main
        className={`${pane === "chamado" ? "flex" : "hidden"} min-h-0 min-w-0 flex-col overflow-hidden lg:flex`}
      >
        {composing ? (
          <form onSubmit={openTicket} className="flex min-h-0 flex-1 flex-col">
            <header className="flex min-h-28 shrink-0 flex-col justify-center border-b border-line px-4 py-3 sm:px-6">
              <p className="text-[13px] text-muted">Novo chamado</p>
              <h2 className="mt-1 font-serif text-[30px] leading-tight">
                O que aconteceu?
              </h2>
            </header>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-5 sm:px-6">
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Assunto"
                className="w-full min-w-0 rounded-md border border-line bg-white px-4 py-3 font-serif text-2xl outline-none transition-colors placeholder:text-[#b7ad9f] hover:border-[#b7ad9f] focus:border-ink"
              />
              <textarea
                value={opening}
                onChange={(event) => setOpening(event.target.value)}
                placeholder="Descreva o problema com o que você já tentou."
                className="min-h-40 w-full min-w-0 flex-1 resize-none rounded-md border border-line bg-white px-4 py-3 text-[15px] leading-6 outline-none transition-colors placeholder:text-[#b7ad9f] hover:border-[#b7ad9f] focus:border-ink"
              />
            </div>
            <div className="border-t border-line bg-[#ebe4d8] px-4 py-3 sm:px-6">
              {error ? (
                <p className="mb-2 break-words text-sm text-mark">{error}</p>
              ) : null}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setComposing(false);
                    setError("");
                  }}
                  className="cursor-pointer rounded-md border border-[#cfc4b2] bg-white px-2.5 py-1.5 text-sm text-ink transition-colors hover:bg-[#f3efe7]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="cursor-pointer rounded-md bg-ink px-3 py-1.5 text-sm text-paper transition-colors hover:bg-[#322c26] disabled:opacity-50"
                >
                  Abrir chamado
                </button>
              </div>
            </div>
          </form>
        ) : selected ? (
          <>
            <header className="flex min-h-28 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted">
                  #{selected.id} · aberto {formatWhen(selected.createdAt)}
                </p>
                <h2 className="mt-1 truncate font-serif text-[26px] leading-tight sm:text-[30px]">
                  {selected.subject}
                </h2>
              </div>
              <span className="shrink-0">
                <StatusMark status={selected.status} />
              </span>
            </header>

            <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6">
              {selected.messages.map((message) => {
                const fromAgent = message.author === "atendente";
                const fromAi = message.author === "ia";
                const authorLabel = fromAgent
                  ? "Atendente"
                  : fromAi
                    ? "IA"
                    : "Cliente";
                return (
                  <li
                    key={message.id}
                    className={
                      fromAgent
                        ? "w-full max-w-2xl rounded-md border border-[#d5e3d9] bg-[#f4f8f5] px-4 py-3"
                        : fromAi
                          ? "w-full max-w-2xl rounded-md border border-[#e7d7b8] bg-[#fbf6ea] px-4 py-3"
                          : "w-full max-w-2xl rounded-md border border-line bg-white px-4 py-3"
                    }
                  >
                    <p className="text-[12px] text-muted">
                      {authorLabel} · {formatWhen(message.createdAt)}
                    </p>
                    <p className="mt-1 break-words text-[15px] leading-6">
                      {message.body}
                    </p>
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
              onSuggest={suggest}
              onAssume={assume}
              onResolve={resolve}
            />
          </>
        ) : loading ? (
          <TicketPaneSkeleton />
        ) : (
          <p className="px-4 py-10 text-muted sm:px-6">
            {error || "Escolha um chamado na fila."}
          </p>
        )}
      </main>
      <ArticlesColumn shown={pane === "base"} />
      </div>
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
  onSuggest,
  onAssume,
  onResolve,
}: {
  status: Status;
  draft: string;
  busy: boolean;
  error: string;
  onDraft: (value: string) => void;
  onReply: (event: FormEvent) => void;
  onSuggest: () => void;
  onAssume: () => void;
  onResolve: () => void;
}) {
  if (status === "RESOLVIDO") {
    return (
      <div className="border-t border-line bg-[#ebe4d8] px-4 py-4 text-sm text-muted sm:px-6">
        Este chamado está encerrado. O histórico fica aqui.
      </div>
    );
  }

  if (status === "NOVO" || status === "NA_FILA") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#ebe4d8] px-4 py-3 sm:px-6">
        <p className="min-w-0 flex-1 text-sm text-muted">
          {status === "NA_FILA"
            ? "A IA não soube responder com a base publicada."
            : "Este chamado ainda não foi assumido."}
          {error ? (
            <span className="mt-1 block break-words text-mark">{error}</span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={onAssume}
          disabled={busy}
          className="shrink-0 cursor-pointer rounded-md bg-ink px-3 py-1.5 text-sm text-paper transition-colors hover:bg-[#322c26] disabled:opacity-50"
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
        className="border-t border-line bg-[#ebe4d8] px-4 py-3 sm:px-6"
      >
        {error ? (
          <p className="mb-2 break-words text-sm text-mark">{error}</p>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-end gap-2 rounded-md border border-[#cfc4b2] bg-white px-3 py-2">
          <textarea
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            placeholder="Escreva a resposta"
            rows={2}
            className="max-h-28 min-h-12 w-full min-w-0 flex-1 basis-full resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-[#b7ad9f] sm:basis-[12rem]"
          />
          <div className="ml-auto flex max-w-full flex-wrap justify-end gap-1">
            <button
              type="button"
              onClick={onSuggest}
              disabled={busy}
              className="cursor-pointer rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm text-ink transition-colors hover:bg-[#e7e0d4] disabled:opacity-50"
            >
              Sugerir
            </button>
            <button
              type="button"
              onClick={onResolve}
              disabled={busy}
              className="cursor-pointer rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm text-ink transition-colors hover:bg-[#e7e0d4] disabled:opacity-50"
            >
              Resolver
            </button>
            <button
              type="submit"
              disabled={busy}
              className="cursor-pointer rounded-md bg-ink px-3 py-1.5 text-sm text-paper transition-colors hover:bg-[#322c26] disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </div>
      </form>
    );
  }

  if (status === "AGUARDANDO_CLIENTE") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#ebe4d8] px-4 py-3 sm:px-6">
        <p className="min-w-0 flex-1 text-sm text-muted">
          Aguardando o cliente. A resposta já foi enviada.
          {error ? (
            <span className="mt-1 block break-words text-mark">{error}</span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={onResolve}
          disabled={busy}
          className="shrink-0 cursor-pointer rounded-md bg-ink px-3 py-1.5 text-sm text-paper transition-colors hover:bg-[#322c26] disabled:opacity-50"
        >
          Resolver
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-line bg-[#ebe4d8] px-4 py-4 text-sm text-muted sm:px-6">
      Esse status ainda não tem ação na mesa.
    </div>
  );
}
