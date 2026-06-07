import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import * as oauth from 'oauth4webapi';
import { getDb } from '../db';
import { getIdPById, discoverIssuer, buildAuthorizeUrl, exchangeCode } from './oidc';
import { generateToken } from './middleware';
import { logError } from '../lib/logger';

const sso = new Hono();

function getSecureFlag(url: string): boolean {
  return url.startsWith('https://');
}

async function getCallbackUri(urlStr: string): Promise<string> {
  const url = new URL(urlStr);
  return `${url.origin}/api/auth/sso/callback`;
}

sso.get('/providers', async (c) => {
  const db = getDb();
  const rows = db
    .query('SELECT id, name, provider_type FROM identity_providers WHERE enabled = 1')
    .all() as {
    id: number;
    name: string;
    provider_type: string;
  }[];
  return c.json(rows);
});

sso.get('/:id/initiate', async (c) => {
  const id = parseInt(c.req.param('id') || '');
  if (isNaN(id)) {
    return c.json({ error: 'Invalid provider ID' }, 400);
  }

  const idp = getIdPById(id);
  if (!idp) {
    return c.json({ error: 'Identity provider not found' }, 404);
  }

  let as: oauth.AuthorizationServer;
  try {
    as = await discoverIssuer(idp.config.issuerUrl);
  } catch (err) {
    logError('SSO discoverIssuer failed:', err);
    return c.json({ error: 'Failed to connect to identity provider' }, 502);
  }

  const reqUrl = c.req.url;
  const redirectUri = await getCallbackUri(reqUrl);
  const codeVerifier = oauth.generateRandomCodeVerifier();
  const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
  const state = oauth.generateRandomState();
  const nonce = oauth.generateRandomNonce();

  const authUrl = buildAuthorizeUrl(as, idp.config, redirectUri, state, codeChallenge, nonce);

  const secure = getSecureFlag(reqUrl);
  const cookieOptions = {
    path: '/api/auth/sso',
    maxAge: 600,
    httpOnly: true,
    sameSite: 'Lax' as const,
    secure,
  };

  setCookie(c, 'sso_state', state, cookieOptions);
  setCookie(c, 'sso_nonce', nonce, cookieOptions);
  setCookie(c, 'sso_verifier', codeVerifier, cookieOptions);
  setCookie(c, 'sso_provider_id', String(id), cookieOptions);

  return c.redirect(authUrl.toString());
});

sso.get('/callback', async (c) => {
  const state = c.req.query('state');
  const code = c.req.query('code');
  const error = c.req.query('error');

  if (error) {
    return c.json({ error: 'SSO authentication failed' }, 400);
  }

  const cookieState = getCookie(c, 'sso_state');
  const cookieNonce = getCookie(c, 'sso_nonce');
  const cookieVerifier = getCookie(c, 'sso_verifier');
  const cookieProviderId = getCookie(c, 'sso_provider_id');

  if (!cookieState || !cookieNonce || !cookieVerifier || !cookieProviderId) {
    return c.json({ error: 'SSO authentication failed' }, 500);
  }

  if (state !== cookieState) {
    return c.json({ error: 'SSO authentication failed' }, 500);
  }

  if (!code) {
    return c.json({ error: 'SSO authentication failed' }, 500);
  }

  const providerId = parseInt(cookieProviderId);
  const idp = getIdPById(providerId);
  if (!idp) {
    return c.json({ error: 'SSO authentication failed' }, 500);
  }

  let as: oauth.AuthorizationServer;
  try {
    as = await discoverIssuer(idp.config.issuerUrl);
  } catch (err) {
    logError('SSO callback discoverIssuer failed:', err);
    return c.json({ error: 'SSO authentication failed' }, 500);
  }

  const redirectUri = await getCallbackUri(c.req.url);

  let exchangeResult: { idToken: string; accessToken?: string; claims: Record<string, unknown> };
  try {
    exchangeResult = await exchangeCode(
      as,
      idp.config,
      redirectUri,
      code,
      cookieVerifier,
      cookieNonce
    );
  } catch (err) {
    logError('SSO code exchange failed:', err);
    return c.json({ error: 'SSO authentication failed' }, 500);
  }

  const claims = exchangeResult.claims;
  const sub = claims.sub as string;
  const email = (claims.email as string) || null;
  const name = (claims.name as string) || (claims.preferred_username as string) || sub;

  const db = getDb();

  let user = db
    .query('SELECT * FROM users WHERE source = ? AND subject_id = ?')
    .get('oidc', sub) as
    | {
        id: number;
        username: string;
        is_active: number;
      }
    | undefined;

  if (!user) {
    const result = db.run(
      'INSERT INTO users (username, password_hash, source, subject_id, email, is_admin) VALUES (?, ?, ?, ?, ?, 0)',
      [name, '', 'oidc', sub, email]
    );
    const userId = Number(result.lastInsertRowid);
    user = { id: userId, username: name, is_active: 1 };
  } else if (user.is_active === 0) {
    return c.json({ error: 'SSO authentication failed' }, 403);
  }

  const token = generateToken(user.id, user.username);

  deleteCookie(c, 'sso_state');
  deleteCookie(c, 'sso_nonce');
  deleteCookie(c, 'sso_verifier');
  deleteCookie(c, 'sso_provider_id');

  const userJson = JSON.stringify({ id: user.id, username: user.username });
  const html = `<!DOCTYPE html><html><body><script>
    localStorage.setItem('traefik_ui_token', '${token}');
    localStorage.setItem('traefik_ui_user', JSON.stringify(${userJson}));
    window.location.href = '/';
  </script></body></html>`;

  return c.html(html);
});

export { sso };
