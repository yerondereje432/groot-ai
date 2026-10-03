"use client";

/**
 * Thin client for `apps/api`. Replaces the previous direct-to-Supabase
 * calls throughout the web app.
 *
 * There is no signup/signin wall: on first use this transparently creates
 * a guest session (`POST /auth/guest`) and stores the resulting JWT pair
 * in localStorage, the same way an anonymous ChatGPT-style session works.
 * The student is never shown a login screen. See docs/architecture.md
 * "Authentication" for the rationale and `apps/api`'s
 * `AuthService.guest()` for the server side.
 */

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000/api/v1";

const ACCESS_TOKEN_KEY = "groot_access_token";
const REFRESH_TOKEN_KEY = "groot_refresh_token";
export const GRADE_KEY = "groot_grade";
export const SUBJECT_KEY = "groot_subject";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface StoredSubject {
  id: string;
  name: string;
}

function readLocal(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function writeLocal(key: string, value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function clearLocal(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

export function getStoredGrade(): number | null {
  const raw = readLocal(GRADE_KEY);
  return raw ? parseInt(raw, 10) : null;
}

export function setStoredGrade(grade: number) {
  writeLocal(GRADE_KEY, String(grade));
}

export function getStoredSubject(): StoredSubject | null {
  const raw = readLocal(SUBJECT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSubject;
  } catch {
    return null;
  }
}

export function setStoredSubject(subject: StoredSubject) {
  writeLocal(SUBJECT_KEY, JSON.stringify(subject));
}

/** Clears grade + subject (but keeps the guest session token) — lets a student restart the picker without losing their account/history. */
export function resetStudySelection() {
  clearLocal(GRADE_KEY);
  clearLocal(SUBJECT_KEY);
}

function storeTokens(tokens: AuthTokens) {
  writeLocal(ACCESS_TOKEN_KEY, tokens.accessToken);
  writeLocal(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

function clearTokens() {
  clearLocal(ACCESS_TOKEN_KEY);
  clearLocal(REFRESH_TOKEN_KEY);
}

async function createGuestSession(grade?: number): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/auth/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(grade ? { grade } : {}),
  });
  if (!res.ok) {
    throw new Error(`Could not start a session (${res.status}). Is the API reachable at ${BACKEND_URL}?`);
  }
  const tokens = (await res.json()) as AuthTokens;
  storeTokens(tokens);
  return tokens.accessToken;
}

async function refreshSession(): Promise<string | null> {
  const refreshToken = readLocal(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    return null;
  }
  const tokens = (await res.json()) as AuthTokens;
  storeTokens(tokens);
  return tokens.accessToken;
}

/** Ensures a valid access token exists, transparently creating a guest session if needed. Call once on app load (and whenever the grade is first chosen). */
export async function ensureSession(grade?: number): Promise<string> {
  const existing = readLocal(ACCESS_TOKEN_KEY);
  if (existing) return existing;
  return createGuestSession(grade);
}

/**
 * Authenticated fetch against the Groot API. Adds the bearer token
 * automatically and transparently retries once — refreshing the token, or
 * falling back to a brand-new guest session — on a 401.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await ensureSession();
  const doFetch = (bearer: string) =>
    fetch(`${BACKEND_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
        Authorization: `Bearer ${bearer}`,
      },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshed = (await refreshSession()) ?? (await createGuestSession());
    res = await doFetch(refreshed);
  }
  return res;
}
