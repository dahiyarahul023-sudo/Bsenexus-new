import { getSupabase } from "./supabase.js";
import { AiError, hashSecret } from "../ai/policy.js";
type AiStorageOptions = { timeoutMs?: number; signal?: AbortSignal };
export async function aiDb<T = any>(
  fn: (
    db: ReturnType<typeof getSupabase>,
  ) => PromiseLike<{ data: T | null; error: any }>,
  options: AiStorageOptions = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 10000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  let onAbort: (() => void) | undefined;
  try {
    if (signal.aborted) throw signal.reason;
    const deadline = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
    });
    let query: any = fn(getSupabase());
    if (typeof query.abortSignal === "function")
      query = query.abortSignal(signal);
    // Cancellation is cooperative. Independently bound a dependency that
    // ignores its signal; race also observes any eventual rejection.
    const { data, error } = await Promise.race([
      Promise.resolve(query),
      deadline,
    ]);
    if (error) throw error;
    return data as T;
  } catch {
    throw new AiError(
      "connection_storage_unavailable",
      503,
      "Connection storage is unavailable. Please retry.",
    );
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort);
  }
}
export async function aiRpc(
  name: string,
  args: Record<string, unknown>,
  options: AiStorageOptions = {},
) {
  const data = await aiDb((db) => db.rpc(name, args), options);
  if (!data || typeof data !== "object")
    throw new AiError("connection_storage_unavailable", 503);
  if (data.error)
    throw new AiError(
      data.error,
      data.error === "invalid_token"
        ? 401
        : data.error === "quota_exceeded"
          ? 429
          : ["pro_required", "scope_required"].includes(data.error)
            ? 403
            : data.error === "not_found"
              ? 404
              : 409,
    );
  return data;
}
export function relation(value: any): any {
  return Array.isArray(value) ? (value.length === 1 ? value[0] : null) : value;
}
export async function readConnectionToken(token: string) {
  if (!/^bnx_at_[A-Za-z0-9_-]{43}$/.test(token))
    throw new AiError("invalid_token", 401);
  const row = await aiDb((db) =>
    db
      .from("ai_connection_secrets")
      .select(
        "grant_id,expires_at,resource,ai_connection_grants!inner(id,uid,client_id,scopes,expires_at,revoked_at)",
      )
      .eq("hash", hashSecret(token))
      .eq("kind", "access")
      .maybeSingle(),
  );
  const grant = relation(row?.ai_connection_grants);
  if (
    !row ||
    !grant ||
    grant.revoked_at ||
    Date.parse(row.expires_at) <= Date.now() ||
    Date.parse(grant.expires_at) <= Date.now()
  )
    throw new AiError("invalid_token", 401);
  return { row, grant };
}
