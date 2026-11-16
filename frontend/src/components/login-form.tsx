"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";
import { LoginSkeleton } from "./skeleton";
import { readSession, saveSession, type SessionUser } from "../lib/session";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"entrar" | "cadastrar">("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = readSession();
    if (session?.user.role === "ATENDENTE") {
      router.replace("/");
      return;
    }
    if (session) {
      router.replace("/cliente");
      return;
    }
    setReady(true);
  }, [router]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextName = name.trim();
    const nextEmail = email.trim();
    const nextPassword = password;
    if (busy) return;
    if (mode === "cadastrar" && !nextName) {
      setError("Informe o nome");
      return;
    }
    if (!nextEmail || nextPassword.length < 6) {
      setError("Informe o email e uma senha de 6 caracteres.");
      return;
    }
    setBusy(true);
    setError("");
    void (async () => {
      try {
        if (mode === "cadastrar") {
          await api("/auth/register", {
            method: "POST",
            body: JSON.stringify({
              name: nextName,
              email: nextEmail,
              password: nextPassword,
            }),
          });
        }
        const result = await api<{ token: string; user: SessionUser }>(
          "/auth/login",
          {
            method: "POST",
            body: JSON.stringify({
              email: nextEmail,
              password: nextPassword,
            }),
          },
        );
        saveSession(result);
        router.replace(result.user.role === "ATENDENTE" ? "/" : "/cliente");
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível falar com o servidor.",
        );
      } finally {
        setBusy(false);
      }
    })();
  }

  if (!ready) {
    return <LoginSkeleton />;
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="bg-rail px-6 py-8 text-rail-ink lg:px-10 lg:py-12">
        <h1 className="font-serif text-4xl leading-none">HelpDesk</h1>
        <p className="mt-4 max-w-xs text-[15px] leading-6 text-[#c8bfb2]">
          Clientes abrem chamados. Atendentes respondem pela mesa.
        </p>
      </aside>
      <main className="flex items-center bg-paper px-6 py-10">
        <form onSubmit={submit} className="w-full max-w-md">
          <p className="text-[13px] text-muted">
            {mode === "entrar" ? "Entrar" : "Cadastrar"}
          </p>
          <h2 className="mt-1 font-serif text-[32px] leading-tight">
            {mode === "entrar" ? "Acesse a sua conta" : "Crie a sua conta"}
          </h2>
          <div className="mt-6 flex flex-col gap-3">
            {mode === "cadastrar" ? (
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nome"
                autoComplete="name"
                className="w-full rounded-md border border-line bg-white px-4 py-3 text-[15px] outline-none transition-colors placeholder:text-[#b7ad9f] hover:border-[#b7ad9f] focus:border-ink"
              />
            ) : null}
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              type="email"
              autoComplete="email"
              className="w-full rounded-md border border-line bg-white px-4 py-3 text-[15px] outline-none transition-colors placeholder:text-[#b7ad9f] hover:border-[#b7ad9f] focus:border-ink"
            />
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Senha"
              type="password"
              autoComplete={
                mode === "entrar" ? "current-password" : "new-password"
              }
              className="w-full rounded-md border border-line bg-white px-4 py-3 text-[15px] outline-none transition-colors placeholder:text-[#b7ad9f] hover:border-[#b7ad9f] focus:border-ink"
            />
          </div>
          {error ? (
            <p className="mt-3 break-words text-sm text-mark">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-4 cursor-pointer rounded-md bg-ink px-3 py-1.5 text-sm text-paper transition-colors hover:bg-[#322c26] disabled:opacity-50"
          >
            {mode === "entrar" ? "Entrar" : "Cadastrar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "entrar" ? "cadastrar" : "entrar");
              setError("");
            }}
            className="mt-4 block cursor-pointer text-sm text-ink underline decoration-[#cfc4b2] underline-offset-4 hover:decoration-ink"
          >
            {mode === "entrar"
              ? "Não tem conta? Cadastre-se"
              : "Já tem conta? Entrar"}
          </button>
          <p className="mt-8 text-[13px] leading-5 text-muted">
            Conta de atendente: atendente@helpdesk.local · atendente123
          </p>
        </form>
      </main>
    </div>
  );
}
