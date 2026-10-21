import type { Response } from "express";
import { redirectUriMatches } from "@modelcontextprotocol/sdk/server/auth/handlers/authorize.js";
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type {
  OAuthClientInformationFull,
  OAuthTokens,
  OAuthTokenRevocationRequest,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  InvalidGrantError,
  InvalidClientMetadataError,
  InvalidScopeError,
  InvalidTokenError,
  InvalidRequestError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import {
  aiDb,
  aiRpc,
  readConnectionToken,
  relation,
} from "../database/aiConnectionsDao.js";
import {
  SCOPES,
  AiError,
  newSecret,
  hashSecret,
  publicOrigin,
  resourceUrl,
  validateRedirect,
} from "./policy.js";

export class BsenexusOAuthProvider implements OAuthServerProvider {
  constructor(private storage: {db: typeof aiDb; rpc: typeof aiRpc} = {db:aiDb,rpc:aiRpc}) {}
  clientsStore = {
    getClient: async (
      clientId: string,
    ): Promise<OAuthClientInformationFull | undefined> => {
      if (!/^[a-f0-9-]{36}$/.test(clientId)) return undefined;
      const row = await this.storage.db((db) =>
        db
          .from("ai_connection_clients")
          .select("metadata")
          .eq("id", clientId)
          .maybeSingle(),
        { timeoutMs: 2000 },
      );
      return row?.metadata;
    },
    registerClient: async (
      metadata: Omit<
        OAuthClientInformationFull,
        "client_id" | "client_id_issued_at"
      >,
    ): Promise<OAuthClientInformationFull> => {
      if (
        metadata.grant_types?.some(kind => !["authorization_code","refresh_token"].includes(kind)) ||
        metadata.response_types?.some(kind => kind !== "code") ||
        metadata.token_endpoint_auth_method !== "none" ||
        !metadata.redirect_uris?.length ||
        metadata.redirect_uris.length > 3
      )
        throw new InvalidClientMetadataError(
          "Only public authorization-code/refresh PKCE clients with 1–3 HTTPS or HTTP loopback callbacks are supported.",
        );
      let redirects: string[];
      try {
        redirects = metadata.redirect_uris.map(validateRedirect);
      } catch {
        throw new InvalidClientMetadataError(
          "Callbacks require public HTTPS without custom ports, or exact HTTP localhost/127.0.0.1 loopback addresses; credentials and fragments are forbidden.",
        );
      }
      const id = crypto.randomUUID();
      const safe: OAuthClientInformationFull = {
        client_id: id,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: String(metadata.client_name || "AI application")
          .replace(/[\x00-\x1f]/g, "")
          .slice(0, 80),
        redirect_uris: redirects,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: SCOPES.join(" "),
      };
      await this.storage.rpc("register_ai_connection_client", {
        p_id: id,
        p_metadata: safe,
      });
      return safe;
    },
  };
  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ) {
    if (
      !params.state ||
      params.state.length > 512 ||
      !/^[-_A-Za-z0-9]{43}$/.test(params.codeChallenge)
    )
      throw new InvalidRequestError("State and S256 PKCE are required.");
    if (params.resource && params.resource.href !== resourceUrl())
      throw new InvalidRequestError("Invalid resource.");
    const scopes = Array.from(
      new Set([
        "account:read",
        ...(params.scopes?.length ? params.scopes : ["market:read"]),
      ]),
    );
    if (scopes.some((s) => !SCOPES.includes(s as any)))
      throw new InvalidScopeError("Unknown permission.");
    if (!client.redirect_uris.some(registered => redirectUriMatches(params.redirectUri, registered)))
      throw new InvalidRequestError("Callback mismatch.");
    const started = Date.now();
    const traceId = crypto.randomUUID();
    const log = (stage: string) => ({
      traceId, stage, elapsedMs: Date.now() - started,
    });
    // Safe operation stages distinguish persistence from a response delivered
    // to the hosting gateway. Never include query strings or consent secrets.
    res.once("finish", () => {
      console.info("[AI OAuth authorize]", {
        ...log("response_finished"), status: res.statusCode,
      });
    });
    try {
      const request = newSecret("req");
      await this.storage.rpc("begin_ai_connection_request", {
        p_hash: hashSecret(request),
        p_client: client.client_id,
        p_params: { ...params, resource: resourceUrl(), scopes },
      }, { timeoutMs: 2000 });
      console.info("[AI OAuth authorize]", log("consent_persisted"));
      if (res.destroyed || res.writableEnded) return;
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Referrer-Policy", "no-referrer");
      // The public ingress follows HTTP redirects internally, leaving the
      // browser at /authorize without the pending-consent token. Navigate in
      // the browser instead. Only our freshly generated opaque token enters
      // this fixed same-origin destination; no caller-supplied return URL.
      const destination = "/plugin?request=" + encodeURIComponent(request);
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.status(200).type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="refresh" content="0;url=${destination}">
<title>Continue to Bsenexus</title></head>
<body><main><h1>Connecting to Bsenexus</h1>
<p><a href="${destination}">Continue to review permissions</a></p>
</main></body></html>`);
    } catch (error) {
      console.warn("[AI OAuth authorize]", {
        ...log("consent_unavailable"),
        code: error instanceof AiError ? error.code : "response_unavailable",
      });
      if (res.destroyed || res.writableEnded) return;
      res.status(503).json({
        error: "temporarily_unavailable",
        error_description:
          "Connection setup is temporarily unavailable. Start again from your AI application.",
      });
    }
  }
  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    code: string,
  ) {
    if (!/^bnx_code_[A-Za-z0-9_-]{43}$/.test(code))
      throw new InvalidGrantError("Invalid code.");
    const row = await this.storage.db((db) =>
      db
        .from("ai_connection_secrets")
        .select(
          "challenge,expires_at,used_at,ai_connection_grants!inner(client_id,revoked_at)",
        )
        .eq("hash", hashSecret(code))
        .eq("kind", "code")
        .maybeSingle(),
    );
    if (
      !row ||
      row.used_at ||
      relation(row.ai_connection_grants)?.client_id !== client.client_id ||
      relation(row.ai_connection_grants)?.revoked_at ||
      Date.parse(row.expires_at) <= Date.now()
    )
      throw new InvalidGrantError("Code expired or already used.");
    return row.challenge;
  }
  private async exchange(
    client: OAuthClientInformationFull,
    secret: string,
    kind: "code" | "refresh",
    redirect?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    if (resource && resource.href !== resourceUrl())
      throw new InvalidGrantError("Resource mismatch.");
    if (
      !new RegExp(
        `^bnx_${kind === "code" ? "code" : "rt"}_[A-Za-z0-9_-]{43}$`,
      ).test(secret)
    )
      throw new InvalidGrantError("Invalid grant.");
    const access = newSecret("at"),
      refresh = newSecret("rt");
    try {
      const row = await this.storage.rpc("exchange_ai_connection", {
        p_hash: hashSecret(secret),
        p_client: client.client_id,
        p_kind: kind,
        p_redirect: redirect || null,
        p_resource: resourceUrl(),
        p_access: hashSecret(access),
        p_refresh: hashSecret(refresh),
      });
      return {
        access_token: access,
        refresh_token: refresh,
        token_type: "Bearer",
        expires_in: row.expiresIn,
        scope: row.scopes.join(" "),
      };
    } catch (e) {
      if (e instanceof AiError && e.status !== 503)
        throw new InvalidGrantError("Grant expired, revoked or already used.");
      throw e;
    }
  }
  exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    code: string,
    _verifier?: string,
    redirect?: string,
    resource?: URL,
  ) {
    return this.exchange(client, code, "code", redirect, resource);
  }
  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refresh: string,
    scopes?: string[],
    resource?: URL,
  ) {
    if (scopes?.length)
      throw new InvalidScopeError(
        "Refresh preserves the original consent. Reconnect to change permissions.",
      );
    return this.exchange(client, refresh, "refresh", undefined, resource);
  }
  async verifyAccessToken(token: string) {
    try {
      const { row, grant } = await readConnectionToken(token);
      if (row.resource !== resourceUrl())
        throw new InvalidTokenError("Invalid resource.");
      return {
        token,
        clientId: grant.client_id,
        scopes: grant.scopes,
        expiresAt: Math.floor(Date.parse(row.expires_at) / 1000),
        resource: new URL(row.resource),
        extra: { uid: grant.uid, grantId: grant.id },
      };
    } catch (e) {
      if (e instanceof AiError && e.status === 503) throw e;
      throw new InvalidTokenError("Reconnect your Bsenexus account.");
    }
  }
  async revokeToken(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ) {
    const row = await this.storage.db((db) =>
      db
        .from("ai_connection_secrets")
        .select("grant_id")
        .eq("hash", hashSecret(request.token))
        .maybeSingle(),
    );
    if (row)
      await this.storage.db((db) =>
        db
          .from("ai_connection_grants")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", row.grant_id)
          .eq("client_id", client.client_id)
          .select("id"),
      );
  }
}
export const aiOAuthProvider = new BsenexusOAuthProvider();
