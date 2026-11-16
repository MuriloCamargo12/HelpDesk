const KEY = "helpdesk.session";

export type Role = "CLIENTE" | "ATENDENTE";

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
};

export type Session = {
  token: string;
  user: SessionUser;
};

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.token || !parsed.user?.id || !parsed.user.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
