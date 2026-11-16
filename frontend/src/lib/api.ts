import { readSession } from "./session";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";


export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const session = readSession();
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
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
