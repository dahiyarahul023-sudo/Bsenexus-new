# Dev server port 3000 resilience and startup fallback — 27 October 2026

- User request: "The dev server didn't start, please fix it".
- Triggering condition: `/.env` and `/firebase-applet-config.json` were deleted by the user immediately prior to the prompt.
- Root cause investigation:
  - In the container environment, Cloud Run sets `PORT=8080`.
  - NGINX listens on port 8080 (`0.0.0.0:8080`) acting as the ingress reverse proxy forwarding external traffic to port 3000 (`default-app-port=3000`).
  - Previously, `package.json` defined `"dev": "node --import tsx server.ts"` without an explicit `--port 3000` argument.
  - When `npm run dev` was run or restarted without CLI flags, `resolveServerPort()` checked `process.env.PORT` which was `'8080'`.
  - Binding to port 8080 immediately failed with `EADDRINUSE: Port 8080 is already in use. Stop the existing app process or set PORT to a free port.`.
  - Furthermore, config loaders in `server/database/firebase.ts`, `server/security/firebaseAdmin.ts`, and `src/firebase.ts` were checked to verify they handle the absence of `firebase-applet-config.json` gracefully without throwing.
- Bounded repair:
  1. Updated `package.json` `"dev"` script from `"node --import tsx server.ts"` to `"node --import tsx server.ts --port 3000"` so `npm run dev` always specifies the mandated applet port 3000.
  2. Updated `server.ts` `startServer()` so that in development (`NODE_ENV !== 'production'`), if no `--port` argument is present in `process.argv` and `process.env.PORT === '8080'`, the default fallback port is set to `'3000'`.
- Verification:
  - `npm run map:impact -- server.ts package.json server/utils/serverStartup.ts` checked.
  - `compile_applet` passed.
  - `lint_applet` (`tsc --noEmit`) passed.
  - Dev server HTTP probe on `http://localhost:3000/` returns `200 OK`.

## Follow-up: Dev server pre-warming & immediate port release on restart (2026-10-29)
- Root cause of `Pre-warming failed: dev server process died`:
  - `gracefulShutdown` in `server.ts` awaited `addLog(...)` before calling `httpServer.close()`, did not close active/idle keep-alive connections in development, and waited for an 8-second force-exit timer instead of exiting once `httpServer.close()` completed.
  - During rapid dev server restarts/pre-warming (`node --import tsx server.ts --port 3000 --port 3000 --host 0.0.0.0`), the previous process kept port 3000 bound for up to 8s, causing the newly spawned dev server to fail with `EADDRINUSE` and exit.
  - Background `setInterval`/`setTimeout` jobs in `server.ts` also registered at module load time before `listenForStartup(httpServer, PORT)` completed.
- Bounded repair:
  - Wrapped background intervals and boot timeouts in `startBackgroundWorkers()`, invoked only after `listenForStartup` binds port 3000, and tracked `setTimeout` handles alongside `setInterval` handles.
  - Updated `gracefulShutdown` to clear all timers immediately, close idle/active connections and `httpServer` before non-blocking log writes, and exit cleanly once `httpServer.close` and `vite?.close()` settle.
  - Added bounded `EADDRINUSE` retry (`6 x 250ms`) in non-production startup in `server.ts` to tolerate transient socket teardown overlaps during dev server restarts.

