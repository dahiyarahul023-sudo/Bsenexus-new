import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { customFetch } from "../api";
import { BseNexusLogo } from "./ui/BseNexusLogo";
import "../styles/ai-connections.css";
interface AiPluginPageProps {
  onEnterTerminal?: (tab?: string) => void;
}
interface Connection {
  id: string;
  name: string;
  scopes: string[];
  expiresAt: string;
}
interface Status {
  plan?: string;
  limits?: { daily: number; perMinute: number; writes: number };
  used?: number;
  connections?: Connection[];
  mcpUrl?: string;
  scopeLabels?: Record<string, string>;
  activity?: { action: string; at: string; status: string }[];
}
interface Consent {
  name: string;
  callbackOrigin: string;
  scopes: string[];
  scopeLabels: Record<string, string>;
}
const PLATFORMS = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    description: "Connect through a compatible MCP app or connection.",
  },
  {
    id: "claude",
    name: "Claude",
    description: "Use a supported remote MCP connection.",
  },
  {
    id: "other",
    name: "Another AI",
    description: "For clients that support remote MCP and OAuth.",
  },
];
export const AiPluginPage: React.FC<AiPluginPageProps> = ({
  onEnterTerminal,
}) => {
  const { user, authLoading, setIsAuthModalOpen } = useAuth();
  const [status, setStatus] = useState<Status | null>(null),
    [consent, setConsent] = useState<Consent | null>(null);
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [scopes, setScopes] = useState<string[]>([]),
    [selected, setSelected] = useState(
      () => new URLSearchParams(window.location.search).get("ai") || "",
    );
  const [copied, setCopied] = useState(false),
    [retry, setRetry] = useState(0);
  const [search, setSearch] = useState(window.location.search);
  const request = new URLSearchParams(search).get("request") || "";
  const epoch = useRef(0);
  const signedIn = Boolean(user && !user.isAnonymous);
  useEffect(() => {
    const oldTitle = document.title;
    document.title = "AI Connections | Bsenexus";
    return () => {
      document.title = oldTitle;
    };
  }, []);
  useEffect(() => {
    const fn = () => {
      setSearch(window.location.search);
      setSelected(new URLSearchParams(window.location.search).get("ai") || "");
    };
    window.addEventListener("popstate", fn);
    return () => window.removeEventListener("popstate", fn);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const current = ++epoch.current;
    setStatus(null);
    setConsent(null);
    setError("");
    setNotice("");
    if (!signedIn) {
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    void (async () => {
      try {
        const response = await customFetch(
          "/api/ai/connections" +
            (request ? "/request?request=" + encodeURIComponent(request) : ""),
          { signal: controller.signal, cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Could not load your connections.");
        if (current !== epoch.current || controller.signal.aborted) return;
        if (request) {
          setConsent(data);
          setScopes(data.scopes.filter((s: string) => s.endsWith(":read")));
        } else setStatus(data);
      } catch (e: any) {
        if (!controller.signal.aborted && current === epoch.current)
          setError(e.message || "Connection settings are unavailable.");
      } finally {
        if (!controller.signal.aborted && current === epoch.current)
          setLoading(false);
      }
    })();
    return () => {
      controller.abort();
      epoch.current++;
    };
  }, [user?.uid, signedIn, request, retry]);
  const choose = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("ai", id);
    window.history.pushState(null, "", url.pathname + url.search);
    setSearch(url.search);
    setSelected(id);
    setNotice("");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        status?.mcpUrl || "https://bsenexus.in/mcp",
      );
      setCopied(true);
      setNotice("Connection address copied.");
    } catch {
      setNotice("Copy was blocked. Select and copy the address below.");
    }
  };
  const revoke = async (id: string) => {
    const current = epoch.current;
    setBusy(id);
    setError("");
    try {
      const res = await customFetch(
        "/api/ai/connections/" + encodeURIComponent(id) + "/revoke",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not disconnect.");
      if (current !== epoch.current) return;
      setStatus((s) =>
        s ? { ...s, connections: s.connections.filter((c) => c.id !== id) } : s,
      );
      setNotice(
        "Disconnected. This AI can no longer access your Bsenexus account.",
      );
    } catch (e: any) {
      if (current === epoch.current) setError(e.message);
    } finally {
      if (current === epoch.current) setBusy("");
    }
  };
  const decide = async (allow: boolean) => {
    const current = epoch.current;
    setBusy("consent");
    setError("");
    try {
      const res = await customFetch("/api/ai/connections/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, scopes, allow }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Could not complete this connection.");
      if (current !== epoch.current) return;
      if (data.redirect) {
        window.location.assign(data.redirect);
      } else {
        window.history.replaceState(null, "", "/plugin");
        setSearch("");
        setConsent(null);
        setNotice("Connection cancelled. No access was granted.");
        setRetry((x) => x + 1);
      }
    } catch (e: any) {
      if (current === epoch.current) setError(e.message);
    } finally {
      if (current === epoch.current) setBusy("");
    }
  };
  const back = () => {
    if (request) {
      window.location.assign("/plugin");
      return;
    }
    onEnterTerminal?.("dashboard");
    if (!onEnterTerminal) window.location.assign("/announcements");
  };
  return (
    <div className="ai-connect-page">
      <header className="ai-connect-header">
        <a href="/" className="ai-connect-brand">
          <BseNexusLogo className="w-9 h-9" />
          <span>Bsenexus</span>
        </a>
        <button
          onClick={back}
          className="ai-connect-button ai-connect-secondary"
        >
          <ArrowLeft size={17} />
          <span>Back to terminal</span>
        </button>
      </header>
      <main className="ai-connect-main">
        <div className="ai-connect-intro">
          <span className="ai-connect-eyebrow">
            <Link2 size={16} /> Your account, in your AI
          </span>
          <h1>
            {request
              ? "Choose what your AI can do"
              : "Connect your AI to Bsenexus"}
          </h1>
          <p>
            Ask for company filings, organise your watchlists and manage
            permitted account preferences through conversation.
          </p>
        </div>
        <div
          role="status"
          aria-live="polite"
          className={notice ? "ai-connect-notice" : ""}
        >
          {notice}
        </div>
        {error && (
          <div role="alert" className="ai-connect-error">
            <p>{error}</p>
            <button
              className="ai-connect-button ai-connect-secondary"
              onClick={() => setRetry((x) => x + 1)}
            >
              <RefreshCw size={16} />
              Try again
            </button>
          </div>
        )}
        {authLoading || loading ? (
          <div className="ai-connect-card ai-connect-loading">
            <Loader2 className="animate-spin" />
            <span>Checking your account…</span>
          </div>
        ) : !signedIn ? (
          <section className="ai-connect-card ai-connect-signin">
            <ShieldCheck size={32} />
            <h2>Start with your Bsenexus account</h2>
            <p>
              Sign in to review permissions and manage your connections. Your
              password stays with Bsenexus.
            </p>
            <button
              className="ai-connect-button ai-connect-primary"
              onClick={() => setIsAuthModalOpen(true)}
            >
              Sign in to continue
              <ArrowRight size={18} />
            </button>
            <p className="ai-connect-small">
              Connecting requires a compatible AI client. Its own plan and
              workspace rules still apply.
            </p>
          </section>
        ) : consent ? (
          <section className="ai-connect-card">
            <span className="ai-connect-eyebrow">
              Account permission request
            </span>
            <h2>{consent.name}</h2>
            <p>
              This application is requesting access. Check that you recognise it
              before continuing.
            </p>
            <p className="ai-connect-origin">
              Return address: <strong>{consent.callbackOrigin}</strong>
            </p>
            <p className="ai-connect-small">
              Application names are supplied by their developers. A name alone
              does not verify an application’s identity.
            </p>
            <fieldset className="ai-connect-permissions">
              <legend>Allow this application to:</legend>
              {consent.scopes.map((scope) => (
                <label key={scope}>
                  <input
                    type="checkbox"
                    checked={scopes.includes(scope)}
                    disabled={scope === "account:read" || !!busy}
                    onChange={(e) =>
                      setScopes((old) =>
                        e.target.checked
                          ? [...old, scope]
                          : old.filter((s) => s !== scope),
                      )
                    }
                  />
                  <span>
                    {consent.scopeLabels[scope] || scope}
                    {scope === "account:read" && (
                      <small>Required to identify the connected account</small>
                    )}
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="ai-connect-small">
              Your current plan and usage limits still apply. You can disconnect
              at any time. This connection expires after 30 days.
            </p>
            <div className="ai-connect-actions">
              <button
                disabled={!!busy}
                className="ai-connect-button ai-connect-primary"
                onClick={() => decide(true)}
              >
                {busy ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <ShieldCheck size={18} />
                )}
                Allow selected access
              </button>
              <button
                disabled={!!busy}
                className="ai-connect-button ai-connect-secondary"
                onClick={() => decide(false)}
              >
                Cancel
              </button>
            </div>
          </section>
        ) : status ? (
          <>
            <section className="ai-connect-account ai-connect-card">
              <div>
                <span className="ai-connect-eyebrow">Connected as</span>
                <h2>
                  {user.displayName || user.email || "Your Bsenexus account"}
                </h2>
                <p>
                  {status.plan === "pro" ? "Active Pro access" : "Free account"}{" "}
                  · Resets at midnight IST
                </p>
              </div>
              <div className="ai-connect-meter">
                <strong>
                  {Math.max(0, (status.limits?.daily ?? 0) - (status.used ?? 0))}{" "}
                  <small>/ {status.limits?.daily ?? 0}</small>
                </strong>
                <span>connection requests remaining today</span>
                <small>
                  New AI summaries use your existing website allowance.
                </small>
              </div>
            </section>
            <section aria-labelledby="ai-choice">
              <h2 id="ai-choice">Which AI would you like to connect?</h2>
              <div className="ai-connect-platforms">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    aria-pressed={selected === p.id}
                    className={
                      "ai-connect-card ai-connect-platform " +
                      (selected === p.id ? "is-selected" : "")
                    }
                    onClick={() => choose(p.id)}
                  >
                    <Bot size={25} />
                    <strong>{p.name}</strong>
                    <span>{p.description}</span>
                    <span className="ai-connect-choice">
                      {selected === p.id ? "Selected" : "View connection steps"}
                      <ArrowRight size={16} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
            {selected && (
              <section className="ai-connect-card ai-connect-setup">
                <h2>
                  Connect{" "}
                  {PLATFORMS.find((p) => p.id === selected)?.name || "your AI"}
                </h2>
                <ol>
                  <li>Open your AI’s app or connection settings.</li>
                  <li>Add the Bsenexus remote MCP address shown below.</li>
                  <li>
                    Choose OAuth, sign in to Bsenexus and approve the
                    permissions you want.
                  </li>
                </ol>
                <div className="ai-connect-address">
                  <code>{status.mcpUrl}</code>
                  <button
                    className="ai-connect-button ai-connect-secondary"
                    onClick={copy}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}Copy
                    address
                  </button>
                </div>
                <p className="ai-connect-small">
                  This is a custom connection setup. Bsenexus is not claimed to
                  be published in an AI app directory. Availability depends on
                  your AI client. No API key or code is required for an
                  OAuth-capable client.
                </p>
              </section>
            )}
            <section>
              <div className="ai-connect-section-title">
                <h2>Your AI connections</h2>
                <button
                  className="ai-connect-button ai-connect-secondary"
                  onClick={() => setRetry((x) => x + 1)}
                  aria-label="Refresh connections"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              {status.connections?.length ? (
                status.connections.map((c) => (
                  <article
                    key={c.id}
                    className="ai-connect-card ai-connect-connection"
                  >
                    <div>
                      <h3>
                        <span className="ai-connect-dot" />
                        {c.name}
                      </h3>
                      <p>
                        {c.scopes
                          .map((s) => status.scopeLabels?.[s] || s)
                          .join(" · ")}
                      </p>
                      <small>
                        Expires {new Date(c.expiresAt).toLocaleDateString()}
                      </small>
                    </div>
                    <button
                      disabled={!!busy}
                      className="ai-connect-button ai-connect-secondary"
                      onClick={() => revoke(c.id)}
                    >
                      {busy === c.id ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <Unplug size={16} />
                      )}
                      Disconnect
                    </button>
                  </article>
                ))
              ) : (
                <div className="ai-connect-card ai-connect-empty">
                  <Link2 size={25} />
                  <h3>No AI connected yet</h3>
                  <p>
                    Choose an AI above to see how to connect. It appears here
                    after you approve access.
                  </p>
                </div>
              )}
            </section>
            {!!status.activity?.length && (
              <details className="ai-connect-card ai-connect-developer">
                <summary>
                  Recent AI activity
                  <ChevronDown size={17} />
                </summary>
                <ul>
                  {status.activity.map((a, i) => (
                    <li
                      key={i}
                      className="py-3 border-b border-slate-200 dark:border-slate-700 text-sm"
                    >
                      <strong>{a.action.replaceAll("_", " ")}</strong>
                      <p>
                        {a.status} · {new Date(a.at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : null}
        <section className="ai-connect-assurance">
          <ShieldCheck size={22} />
          <div>
            <strong>You stay in control</strong>
            <p>
              Access is limited to your account, approved permissions, plan and
              allowance. Connections cannot change payments, grant Pro or
              perform admin operations.
            </p>
          </div>
        </section>
        <details className="ai-connect-card ai-connect-developer">
          <summary>
            Developer tools and API reference <ChevronDown size={17} />
          </summary>
          <p>
            Use MCP for account tools. The OpenAPI document describes the four
            authenticated GET data routes. Function declarations require an
            execution loop in your application.
          </p>
          <div className="ai-connect-actions">
            <a
              href="/api/ai/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenAPI JSON
              <ExternalLink size={14} />
            </a>
            <a
              href="/api/ai/gemini-tools.json"
              target="_blank"
              rel="noopener noreferrer"
            >
              Gemini declarations
              <ExternalLink size={14} />
            </a>
          </div>
        </details>
      </main>
      <footer className="ai-connect-footer">
        <a href="/privacy-policy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/contact">Help with connecting</a>
      </footer>
    </div>
  );
};
