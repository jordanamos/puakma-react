// Thin client for the app's v1 JSON API (the `v1` Puakma ACTION).
//
//   api("GET",    "items")            -> GET    /group/app.pma/v1/items
//   api("POST",   "items", {name})    -> POST   /group/app.pma/v1/items      (JSON body)
//   api("PUT",    "items/12", {name}) -> PUT    /group/app.pma/v1/items/12
//   api("DELETE", "items/12")         -> DELETE /group/app.pma/v1/items/12   (empty JSON body, see below)
//
// URLs are relative to the page (/group/app.pma/index?OpenPage), so they stay inside this app and
// the Puakma session cookie (_pma_sess_id) is sent automatically. Every reply is
//   {"status":"ok","data":...}  or  {"status":"error","code":<http>,"message":"..."}
// with a matching HTTP status. 401 means the session is gone: we send the browser to log in.
//
// Puakma quirk: a body-less PUT/DELETE that carries a Content-Type header makes the server's
// body parser throw (HTTP 500), so every non-GET request here sends a JSON body, "{}" if empty.

export const API_BASE = "v1";

export type ApiOk<T> = { status: "ok"; data: T };
export type ApiError = { status: "error"; code: number; message: string };
export type ApiResult<T> = ApiOk<T> | ApiError;
export type Method = "GET" | "POST" | "PUT" | "DELETE";

export class SessionExpired extends Error {
  constructor() {
    super("Session expired");
  }
}

export function loginUrl(): string {
  return "index?OpenPage&login"; // "&login" anywhere in a URI forces the Puakma login page
}

export function logoutUrl(): string {
  return "index?OpenPage&logout"; // "&logout" clears the session
}

export async function api<T = unknown>(method: Method, path: string, body?: unknown): Promise<ApiResult<T>> {
  const init: RequestInit = { method, credentials: "same-origin", headers: { Accept: "application/json" } };
  if (method !== "GET") {
    init.headers = { ...init.headers, "Content-Type": "application/json" };
    init.body = JSON.stringify(body ?? {});
  }
  const r = await fetch(`${API_BASE}/${path.replace(/^\/+/, "")}`, init);
  if (r.status === 401) {
    window.location.assign(loginUrl());
    throw new SessionExpired();
  }
  const ct = r.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    // An HTML reply means Puakma answered instead of v1 (login page, error page, stale class).
    if (ct.includes("text/html")) {
      window.location.assign(loginUrl());
      throw new SessionExpired();
    }
    return { status: "error", code: r.status, message: `Unexpected response (${r.status} ${ct || "no content type"})` };
  }
  return (await r.json()) as ApiResult<T>;
}

/**
 * Stale-client check. The server's ClientBuild keyword (set by `npm run deploy`) says which
 * build it expects; this bundle knows its own id. If they differ, reload once so the browser
 * fetches bundle.js?v=<new id>. Uses v1/ping, so it works before login too. Guarded with
 * sessionStorage so a misconfigured server cannot cause a reload loop.
 */
export async function reloadIfStale(): Promise<void> {
  try {
    const r = await fetch(`${API_BASE}/ping`, { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!r.ok) return;
    const j = (await r.json()) as ApiResult<{ clientBuild?: string }>;
    const expected = j.status === "ok" ? j.data.clientBuild : "";
    if (!expected || expected === __BUILD__.id) return;
    const key = "puakma-react.reloaded-for";
    if (sessionStorage.getItem(key) === expected) return;
    sessionStorage.setItem(key, expected);
    window.location.reload();
  } catch {
    /* offline or not JSON: ignore */
  }
}
