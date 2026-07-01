# Single Sign-On

Traefik-UI ships OIDC single sign-on with PKCE, supports multiple IdPs at once, auto-provisions users on first login, and encrypts IdP client secrets at rest.

## Configure an IdP

Open **Admin → IdP Providers** (screenshot: `docs/screenshots/admin-idp.png`) and click **Add Provider**. You'll be asked for:

- **Provider name** (display label) and **provider slug** (used in the SSO redirect URL)
- **Issuer / discovery URL** — Traefik-UI uses OIDC discovery to fetch the metadata automatically
- **Client ID** and **client secret** (secret is encrypted at rest — see below)
- **Scopes** — defaults to `openid profile email`
- **Enabled** flag — disabled providers are still listed but cannot be initiated
- **Auto-provision** — when on, a new local user is created the first time an unknown identity logs in; assign a default role at provision time

Multiple IdPs can coexist (e.g. Okta for staff, Google Workspace for contractors). Traefik-UI exposes them all on the login screen and routes each to the right callback.

## User flow

1. User clicks an IdP button on `/login`.
2. Browser hits `GET /api/auth/sso/:id/initiate` — backend generates a PKCE verifier, stores it in a short-lived session, and 302s the browser to the IdP's authorize URL.
3. User authenticates with the IdP and returns to `GET /api/auth/sso/callback?code=...&state=...`.
4. Backend exchanges the code (with the PKCE verifier) for tokens, validates the ID token, looks up or auto-provisions the user, and issues a 24-hour JWT identical to the local-login path.
5. Browser is redirected back to the UI with the JWT in place.

## Encryption at rest

IdP client secrets are stored in SQLite after AES-GCM encryption. The key is read from `ENCRYPTION_KEY` (falls back to `JWT_SECRET` if unset). Rotate `ENCRYPTION_KEY` will invalidate stored secrets — set it explicitly and independently in production. See [[Configuration#ENCRYPTION_KEY — encrypts IdP client secrets at rest]].

## Listing providers

Unauthenticated callers see enabled providers only via `GET /api/auth/sso/providers`. Admins see everything (including secrets) via the admin IdP page. Useful for debugging — `GET /api/admin/sso-providers` returns the full list.

## See also

- [[Configuration]] — `ENCRYPTION_KEY`, `JWT_SECRET`
- [[Access-Control]] — what to assign auto-provisioned users
- [[Administration#Production hardening]] — secrets to set before exposing SSO
