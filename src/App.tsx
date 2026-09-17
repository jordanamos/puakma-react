import { useEffect, useState } from "react";
import { api, logoutUrl, SessionExpired } from "./api";

type Me = { user: string; roles: string[]; app: string; appName: string; appVersion: string; clientBuild: string };
type Item = { id: string; name: string; createdBy: string; created: string; updated?: string };

export function App({ appPath }: { appPath: string }) {
  const [me, setMe] = useState<Me | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown) => { if (!(e instanceof SessionExpired)) setError(String(e)); };

  const loadItems = () =>
    api<Item[]>("GET", "items").then((r) => (r.status === "ok" ? setItems(r.data) : setError(r.message))).catch(fail);

  useEffect(() => {
    api<Me>("GET", "me").then((r) => (r.status === "ok" ? setMe(r.data) : setError(r.message))).catch(fail);
    loadItems();
  }, []);

  const add = async () => {
    setError(null);
    const r = await api<Item>("POST", "items", { name });
    if (r.status === "ok") { setName(""); loadItems(); } else setError(r.message);
  };

  const remove = async (id: string) => {
    const r = await api("DELETE", `items/${id}`);
    if (r.status === "ok") loadItems(); else setError(r.message);
  };

  return (
    <main className="rt-main">
      <header className="rt-header">
        <h1>{me?.appName ?? "\u00a0"} <small className="rt-muted">{me?.appVersion}</small></h1>
        <nav><a href={logoutUrl()}>Log out</a></nav>
      </header>

      <p className="rt-muted">
        App <code>{appPath || "(unknown)"}</code>. Starter screen: replace <code>App.tsx</code>, keep{" "}
        <code>api.ts</code>, add routes to the <code>v1</code> action.
      </p>
      <p className="rt-muted">
        Client build {__BUILD_LABEL__} id {__BUILD__.id} at {__BUILD__.time}
        {me ? <> · server expects {me.clientBuild || "(ClientBuild unset)"} · AppVersion {me.appVersion}</> : null}
      </p>

      {error && <p className="rt-error">{error}</p>}

      <section className="rt-card">
        <h2>GET v1/me</h2>
        {!me ? <p>Loading...</p> : (
          <dl>
            <dt>user</dt><dd>{me.user}</dd>
            <dt>roles</dt><dd>{me.roles.length ? me.roles.join(", ") : "(none)"}</dd>
            <dt>appName</dt><dd>{me.appName} <span className="rt-muted">(keyword AppName)</span></dd>
            <dt>appVersion</dt><dd>{me.appVersion} <span className="rt-muted">(keyword AppVersion)</span></dd>
          </dl>
        )}
      </section>

      <section className="rt-card">
        <h2>v1/items (GET, POST, DELETE)</h2>
        <form onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New item name" />
          <button type="submit" disabled={!name.trim()}>Add</button>
        </form>
        {items.length === 0 ? <p className="rt-muted">No items yet.</p> : (
          <ul>
            {items.map((it) => (
              <li key={it.id}>
                {it.name} <span className="rt-muted">({it.createdBy})</span>{" "}
                <button onClick={() => remove(it.id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
