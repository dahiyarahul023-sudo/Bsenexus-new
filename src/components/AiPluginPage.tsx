import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
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
  plan: string;
  limits: { daily: number; perMinute: number; writes: number };
  used: number;
  connections: Connection[];
  mcpUrl: string;
  scopeLabels: Record<string, string>;
  activity?: { action: string; at: string; status: string }[];
}
interface Consent {
  name: string;
  callbackOrigin: string;
  scopes: string[];
  scopeLabels: Record<string, string>;
}
interface Loaded {
  owner: string;
  status?: Status;
  consent?: Consent;
  loading: boolean;
  error: string;
  code: string;
}
const PLATFORMS = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com/",
    field: "MCP endpoint URL",
    help: "https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt",
    open: "On ChatGPT web, open Plugins, choose +, then Add custom MCP server. Name it BSE Nexus. In the older interface, look under Settings → Apps → Create.",
    finish:
      "Choose OAuth, complete the BSE Nexus sign-in and review the tools. Finish creating the plugin, then select BSE Nexus with @ in a new chat.",
    note: "Custom MCP setup is web-only. The options you see depend on your ChatGPT plan and workspace permissions.",
  },
  {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com/",
    field: "MCP server URL",
    help: "https://support.google.com/gemini/answer/17209137?hl=en",
    open: "On Gemini web, open Settings → Connected Apps → Custom apps → Add a custom app. Connected Apps may be inside Personal Intelligence.",
    finish:
      "Choose Next and follow the BSE Nexus sign-in. Leave advanced credentials empty: BSE Nexus supports automatic client registration. After approval, select the app with @ in Gemini.",
    note: "Google currently documents custom apps for eligible personal accounts in the US, in English, with Keep Activity on. Setup happens on the web; connected apps can then be used on mobile. Check Google's availability if this option is missing.",
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai/",
    field: "Remote MCP server URL",
    help: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp",
    open: "Open Customize → Connectors → Add → Add custom connector. Name it BSE Nexus. Team or Enterprise users may need their workspace owner to add it first.",
    finish:
      "Continue with sign-in. If Claude asks how to identify its OAuth client, choose Register automatically. Complete BSE Nexus approval, then enable the connector in your chat.",
    note: "Choose automatic registration for this connection. Provider account and workspace rules still apply.",
  },
  {
    id: "other",
    name: "Another AI",
    url: "",
    field: "Remote MCP server URL",
    help: "",
    open: "In your AI's connection settings, add a remote MCP server. Your AI must support HTTPS Streamable HTTP, OAuth and automatic client registration.",
    finish:
      "Use automatic OAuth sign-in and approve access on BSE Nexus. Return to your AI and finish adding its tools.",
    note: "A client that only accepts a static API key or a local server is not supported by this setup. Use a compatible remote OAuth client.",
  },
];
const platformId = () => {
  const id = new URLSearchParams(window.location.search).get("ai") || "";
  return PLATFORMS.some((p) => p.id === id) ? id : "";
};
function validStatus(data: any): data is Status {
  return (
    data &&
    typeof data.plan === "string" &&
    typeof data.mcpUrl === "string" &&
    Number.isFinite(data.used) &&
    data.used >= 0 &&
    data.limits &&
    ["daily", "perMinute", "writes"].every(
      (k) => Number.isFinite(data.limits[k]) && data.limits[k] >= 0,
    ) &&
    Array.isArray(data.connections) &&
    data.connections.every(
      (c: any) =>
        typeof c.id === "string" &&
        typeof c.name === "string" &&
        Array.isArray(c.scopes) &&
        c.scopes.every((s: any) => typeof s === "string") &&
        Number.isFinite(Date.parse(c.expiresAt)),
    ) &&
    data.scopeLabels &&
    Object.values(data.scopeLabels).every((v) => typeof v === "string") &&
    (!data.activity ||
      (Array.isArray(data.activity) &&
        data.activity.every(
          (a: any) =>
            typeof a.action === "string" &&
            typeof a.status === "string" &&
            Number.isFinite(Date.parse(a.at)),
        )))
  );
}

export const AiPluginPage: React.FC<AiPluginPageProps> = ({
  onEnterTerminal,
}) => {
  const { user, authLoading, setIsAuthModalOpen } = useAuth();
  const [search, setSearch] = useState(window.location.search);
  const request = new URLSearchParams(search).get("request") || "";
  const signedIn = Boolean(user && !user.isAnonymous);
  const owner = JSON.stringify([signedIn ? user!.uid : null, request]);
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const active = loaded?.owner === owner ? loaded : null;
  const status = active?.status,
    consent = active?.consent;
  const [selected, setSelected] = useState(platformId);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const platform = PLATFORMS.find((p) => p.id === selected);
  const [scopes, setScopes] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const action = useRef<symbol | null>(null);
  const [feedback, setFeedback] = useState<{
    owner: string;
    text: string;
    error?: boolean;
  } | null>(null);
  const feedbackHere = feedback?.owner === owner ? feedback : null;
  const [copied, setCopied] = useState(false),
    [retry, setRetry] = useState(0);
  const addressInput = useRef<HTMLInputElement>(null);
  const epoch = useRef(0);

  useEffect(() => {
    const old = document.title;
    document.title = "AI Connections | Bsenexus";
    return () => {
      document.title = old;
    };
  }, []);
  useEffect(() => {
    const sync = () => {
      setSearch(window.location.search);
      setSelected(platformId());
      setCopied(false);
      setFeedback(null);
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    setBusy("");
    action.current = null;
    setCopied(false);
  }, [owner]);
  useEffect(() => {
    const controller = new AbortController();
    const current = ++epoch.current;
    if (!signedIn || authLoading)
      return () => {
        controller.abort();
        epoch.current++;
      };
    setLoaded((old) => ({
      ...(old?.owner === owner ? old : {}),
      owner,
      loading: true,
      error: "",
      code: "",
    }));
    void (async () => {
      try {
        const response = await customFetch(
          "/api/ai/connections" +
            (request ? "/request?request=" + encodeURIComponent(request) : ""),
          { signal: controller.signal, cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok)
          throw Object.assign(
            new Error(data.error || "Could not load your connections."),
            { code: data.code || "" },
          );
        if (
          current !== epoch.current ||
          ownerRef.current !== owner ||
          controller.signal.aborted
        )
          return;
        if (request) {
          if (
            !Array.isArray(data.scopes) ||
            !data.scopes.every((s: unknown) => typeof s === "string") ||
            typeof data.callbackOrigin !== "string" ||
            !data.scopeLabels ||
            !Object.values(data.scopeLabels).every((v) => typeof v === "string")
          )
            throw new Error(
              "Could not read this permission request. Start again from your AI.",
            );
          setScopes(data.scopes.filter((s: string) => s.endsWith(":read")));
          setLoaded({
            owner,
            consent: data,
            loading: false,
            error: "",
            code: "",
          });
        } else {
          if (!validStatus(data))
            throw new Error(
              "Could not read your connection settings. Please retry.",
            );
          setLoaded({
            owner,
            status: data,
            loading: false,
            error: "",
            code: "",
          });
        }
      } catch (e: any) {
        if (
          !controller.signal.aborted &&
          current === epoch.current &&
          ownerRef.current === owner
        )
          setLoaded((old) => ({
            owner,
            status: old?.owner === owner ? old.status : undefined,
            loading: false,
            error: e.message || "Connection settings are unavailable.",
            code: e.code || "",
          }));
      }
    })();
    return () => {
      controller.abort();
      epoch.current++;
    };
  }, [owner, signedIn, authLoading, request, retry]);
  useEffect(() => {
    const refresh = () => {
      if (!request && document.visibilityState === "visible" && !action.current)
        setRetry((n) => n + 1);
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [request]);

  const choose = (id: string) => {
    if (!PLATFORMS.some((p) => p.id === id)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("ai", id);
    window.history.pushState(null, "", url.pathname + url.search);
    setSearch(url.search);
    setSelected(id);
    setCopied(false);
    setFeedback(null);
  };
  const copy = async () => {
    if (!status || !platform || active?.error) return;
    const target = platform;
    try {
      await navigator.clipboard.writeText(status.mcpUrl);
      if (ownerRef.current !== owner || selectedRef.current !== target.id)
        return;
      setCopied(true);
      setFeedback({
        owner,
        text: `Copied. Paste it into ${target.name}'s ${target.field} field in step 2. Copying alone does not connect your account.`,
      });
    } catch {
      if (ownerRef.current !== owner || selectedRef.current !== target.id)
        return;
      addressInput.current?.focus();
      addressInput.current?.select();
      setFeedback({
        owner,
        text: "The address is selected. Touch and hold, or use your browser's Copy command, then paste it in your AI's server URL field.",
      });
    }
  };
  const perform = async (id: string, path: string, body: unknown) => {
    if (action.current) return;
    const job = Symbol();
    action.current = job;
    const current = epoch.current;
    setBusy(id);
    setFeedback(null);
    try {
      const response = await customFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "Could not complete this request. Please retry.",
        );
      if (
        ownerRef.current !== owner ||
        current !== epoch.current ||
        action.current !== job
      )
        return;
      if (id === "consent") {
        if (data.redirect) window.location.assign(data.redirect);
        else {
          window.history.replaceState(null, "", "/plugin");
          setSearch("");
          setFeedback({
            owner: JSON.stringify([user!.uid, ""]),
            text: "Connection cancelled. No access was granted.",
          });
        }
      } else {
        setLoaded((old) =>
          old?.owner === owner && old.status
            ? {
                ...old,
                status: {
                  ...old.status,
                  connections: old.status.connections.filter(
                    (c) => c.id !== id,
                  ),
                },
              }
            : old,
        );
        setFeedback({
          owner,
          text: "Disconnected. This AI can no longer access your BSE Nexus account.",
        });
      }
    } catch (e: any) {
      if (
        ownerRef.current === owner &&
        current === epoch.current &&
        action.current === job
      )
        setFeedback({ owner, text: e.message, error: true });
    } finally {
      if (action.current === job) {
        action.current = null;
        setBusy("");
      }
    }
  };
  const back = () => {
    if (request) {
      window.location.assign("/plugin");
      return;
    }
    if (onEnterTerminal) onEnterTerminal("settings");
    else window.location.assign("/announcements?tab=settings");
  };
  const error = active?.error;
  const initialLoading =
    authLoading ||
    (signedIn && (!active || (active.loading && !status && !consent)));
  const unavailable = active?.code === "connections_not_enabled";

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
          <span>{request ? "Cancel setup" : "Settings"}</span>
        </button>
      </header>
      <main className="ai-connect-main">
        <div className="ai-connect-intro">
          <span className="ai-connect-eyebrow">
            <Link2 size={16} />
            AI Connections
          </span>
          <h1>
            {request
              ? "Choose what your AI can do"
              : "Use BSE Nexus in your AI"}
          </h1>
          <p>
            {request
              ? "Review the app and select its permissions. Editing access is optional."
              : "Find company filings, read your notes and manage permitted watchlists through conversation. Sign in with BSE Nexus—no API key to generate."}
          </p>
        </div>
        {feedbackHere && (
          <div
            role={feedbackHere.error ? "alert" : "status"}
            aria-live="polite"
            className={
              feedbackHere.error ? "ai-connect-error" : "ai-connect-notice"
            }
          >
            {feedbackHere.text}
          </div>
        )}
        {error && (
          <div role="alert" className="ai-connect-error">
            <h2>
              {unavailable
                ? "Connections are not enabled on the server yet"
                : "We couldn't refresh your connection settings"}
            </h2>
            <p>
              {unavailable
                ? "The site administrator needs to finish server setup. A new API key or repeated connection attempts will not resolve this. Try again after setup is complete."
                : error}
            </p>
            {status && (
              <p className="ai-connect-small">
                Previously loaded access is shown below. These settings may have
                changed; retry to check the latest state.
              </p>
            )}
            <button
              disabled={active?.loading || !!busy}
              className="ai-connect-button ai-connect-secondary"
              onClick={() => setRetry((n) => n + 1)}
            >
              <RefreshCw size={16} />
              {active?.loading ? "Checking…" : "Check again"}
            </button>
          </div>
        )}
        {initialLoading ? (
          <div className="ai-connect-card ai-connect-loading">
            <Loader2 className="animate-spin" />
            <span>Checking your account…</span>
          </div>
        ) : !signedIn ? (
          <section className="ai-connect-card ai-connect-signin">
            <ShieldCheck size={32} />
            <h2>Start with your BSE Nexus account</h2>
            <p>
              Sign in to connect your AI and choose what it can access. Your
              password stays with BSE Nexus.
            </p>
            <button
              className="ai-connect-button ai-connect-primary"
              onClick={() => setIsAuthModalOpen(true)}
            >
              Sign in to continue
              <ArrowRight size={18} />
            </button>
            <p className="ai-connect-small">
              Your AI must support remote MCP and OAuth. Its plan, region and
              workspace rules also apply.
            </p>
          </section>
        ) : consent ? (
          <section className="ai-connect-card">
            <span className="ai-connect-eyebrow">
              Account permission request
            </span>
            <h2>{consent.name || "AI application"}</h2>
            <p>Continue only if this is the app you just added in your AI.</p>
            <p className="ai-connect-origin">
              Return address: <strong>{consent.callbackOrigin}</strong>
            </p>
            <p className="ai-connect-small">
              The app developer supplies its name. Check the return address as
              well.
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
              Your plan and usage limits still apply. Access expires after 30
              days; disconnect at any time.
            </p>
            <div className="ai-connect-actions">
              <button
                disabled={!!busy || !!error}
                className="ai-connect-button ai-connect-primary"
                onClick={() =>
                  perform("consent", "/api/ai/connections/authorize", {
                    request,
                    scopes,
                    allow: true,
                  })
                }
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
                onClick={() =>
                  perform("consent", "/api/ai/connections/authorize", {
                    request,
                    scopes,
                    allow: false,
                  })
                }
              >
                Cancel
              </button>
            </div>
            <p className="ai-connect-small">
              After approval, return to your AI and finish its setup.
            </p>
          </section>
        ) : !request ? (
          <>
            {status && (
              <section className="ai-connect-account ai-connect-card">
                <div>
                  <span className="ai-connect-eyebrow">BSE Nexus account</span>
                  <h2>{user!.displayName || user!.email || "Your account"}</h2>
                  <p>
                    {status.plan === "pro"
                      ? "Active Pro access"
                      : "Free account"}
                  </p>
                </div>
                <div className="ai-connect-meter">
                  <strong>
                    {Math.max(0, status.limits.daily - status.used)}{" "}
                    <small>/ {status.limits.daily}</small>
                  </strong>
                  <span>AI tool requests left today</span>
                  <small>
                    Up to {status.limits.perMinute}/minute ·{" "}
                    {status.limits.writes} writes/day
                    <br />
                    Shared across your AI apps · Resets at midnight IST
                  </small>
                </div>
              </section>
            )}
            <section
              className="ai-connect-card ai-connect-setup"
              aria-labelledby="ai-setup-title"
            >
              <h2 id="ai-setup-title">Connect an AI</h2>
              <label className="ai-connect-select-label" htmlFor="ai-platform">
                Which AI do you use?
              </label>
              <select
                id="ai-platform"
                className="ai-connect-select"
                value={selected}
                onChange={(e) => choose(e.target.value)}
              >
                <option value="" disabled>
                  Choose your AI
                </option>
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {platform ? (
                <>
                  <ol className="ai-connect-steps">
                    <li>
                      <strong>
                        Open {platform.name}'s connection settings
                      </strong>
                      <p>{platform.open}</p>
                      {platform.url && (
                        <a
                          className="ai-connect-text-link"
                          href={platform.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open {platform.name}
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </li>
                    <li>
                      <strong>
                        Paste this address into “{platform.field}”
                      </strong>
                      <div className="ai-connect-address">
                        <input
                          ref={addressInput}
                          aria-label="BSE Nexus MCP server URL"
                          readOnly
                          value={status?.mcpUrl || "https://bsenexus.in/mcp"}
                        />
                        <button
                          disabled={!status || !!error}
                          className="ai-connect-button ai-connect-secondary"
                          onClick={copy}
                        >
                          {copied ? <Check size={16} /> : <Copy size={16} />}
                          {copied ? "Copied" : "Copy server URL"}
                        </button>
                      </div>
                      <p className="ai-connect-small">
                        This public address is not an API key. Copying it does
                        not approve access.
                      </p>
                    </li>
                    <li>
                      <strong>Sign in and approve access</strong>
                      <p>{platform.finish}</p>
                      <p className="ai-connect-small">
                        Start with read access. Allow optional edits only when
                        you want your AI to make changes.
                      </p>
                    </li>
                    <li>
                      <strong>Try it in your AI</strong>
                      <p>
                        Ask: “Find the latest TCS filings on BSE Nexus and
                        include the source links.”
                      </p>
                    </li>
                  </ol>
                  <p className="ai-connect-small">
                    {platform.note}
                    {platform.help && (
                      <>
                        {" "}
                        <a
                          className="ai-connect-text-link"
                          href={platform.help}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Official setup help
                          <ExternalLink size={13} />
                        </a>
                      </>
                    )}
                  </p>
                </>
              ) : (
                <p>
                  Select your AI for the exact setup steps. You will approve
                  access on BSE Nexus after adding its server URL.
                </p>
              )}
              {error && (
                <p className="ai-connect-small">
                  The guide is available, but server setup must be working
                  before you can connect.
                </p>
              )}
            </section>
            {status && (
              <section aria-labelledby="ai-approved-title">
                <div className="ai-connect-section-title">
                  <h2 id="ai-approved-title">Approved AI access</h2>
                  <button
                    disabled={!!busy || active?.loading}
                    className="ai-connect-button ai-connect-secondary"
                    onClick={() => setRetry((n) => n + 1)}
                    aria-label="Refresh approved access"
                  >
                    <RefreshCw
                      className={active?.loading ? "animate-spin" : ""}
                      size={16}
                    />
                  </button>
                </div>
                <p className="ai-connect-small">
                  These apps have your permission. Finish setup in the AI itself
                  to use its tools.
                </p>
                {status.connections.length ? (
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
                        <ul className="ai-connect-scope-list" aria-label="Approved permissions">
                          {c.scopes.map((s) => <li key={s}>{status.scopeLabels[s] || s}</li>)}
                        </ul>
                        <small>
                          Access approved · Expires{" "}
                          {new Date(c.expiresAt).toLocaleDateString()}
                        </small>
                      </div>
                      <button
                        disabled={!!busy}
                        className="ai-connect-button ai-connect-secondary"
                        onClick={() =>
                          perform(
                            c.id,
                            "/api/ai/connections/" +
                              encodeURIComponent(c.id) +
                              "/revoke",
                            {},
                          )
                        }
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
                    <h3>No AI access approved yet</h3>
                    <p>
                      Complete the steps above. An app appears here after you
                      approve its permissions.
                    </p>
                  </div>
                )}
              </section>
            )}
            {!!status?.activity?.length && (
              <details className="ai-connect-card ai-connect-developer">
                <summary>
                  Recent AI activity
                  <ChevronDown size={17} />
                </summary>
                <ul>
                  {status.activity.map((a, i) => (
                    <li key={i}>
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
              Only your account, selected permissions and current plan are
              available. AI connections cannot change payments, grant Pro or
              perform admin operations. New summaries use your existing website
              AI allowance.
            </p>
          </div>
        </section>
        <details className="ai-connect-card ai-connect-developer">
          <summary>
            Advanced help
            <ChevronDown size={17} />
          </summary>
          <p>
            Use the MCP server URL for the setup above. OpenAPI JSON is a
            separate developer reference; pasting it into an ordinary AI chat
            does not create a connection. BSE Nexus is not listed in an AI app
            directory by this setup.
          </p>
          <div className="ai-connect-actions">
            <a
              href="/api/ai/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenAPI reference
              <ExternalLink size={14} />
            </a>
            <a href="/ai-docs">
              Setup, tools and data guide
              <ExternalLink size={14} />
            </a>
            <a href="/contact">
              Connection support
              <ExternalLink size={14} />
            </a>
          </div>
        </details>
      </main>
      <footer className="ai-connect-footer">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/contact">Help with connecting</a>
      </footer>
    </div>
  );
};
