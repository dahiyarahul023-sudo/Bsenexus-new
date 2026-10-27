// OAuth secrets must never become error-report or trace payloads.
const secret = /bnx_(?:at|rt|code|req|gift)_[A-Za-z0-9_-]{43}/g;
const privateRoute =
  /\/(?:activate-gift|plugin|ai-plugin|mcp|authorize|token|register|revoke)(?:[/?#]|$)|\/api\/(?:ai|gifts)(?:[/?#]|$)/;
const sensitiveKey =
  /^(?:authorization|cookie|set-cookie|access_token|refresh_token|id_token|client_secret|code_verifier)$/i;
export function redactAiTelemetry<T>(event: T): T {
  const visit = (
    value: any,
    key = "",
    privateRequest = false,
    depth = 0,
  ): any => {
    if (sensitiveKey.test(key)) return "[REDACTED]";
    if (depth > 15) return "[TRUNCATED]";
    if (typeof value === "string") {
      const clean = value.replace(secret, "[REDACTED]");
      return privateRoute.test(clean) && /[?#]/.test(clean)
        ? clean.split(/[?#]/, 1)[0]
        : clean;
    }
    if (!value || typeof value !== "object") return value;
    const privateHere =
      privateRequest || privateRoute.test(String(value.url || ""));
    if (
      privateHere &&
      ["data", "body", "query_string", "cookies"].includes(key)
    )
      return "[REDACTED]";
    if (Array.isArray(value))
      return value.map((v) => visit(v, "", privateHere, depth + 1));
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        privateHere && ["data", "body", "query_string", "cookies"].includes(k)
          ? "[REDACTED]"
          : visit(v, k, privateHere, depth + 1),
      ]),
    );
  };
  return visit(event);
}
