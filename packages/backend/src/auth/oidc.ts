import * as oauth from 'oauth4webapi';
import { getDb } from '../db';
import { decryptSecret } from '../lib/crypto';

export interface IdPConfig {
  issuerUrl: string;
  clientId: string;
  clientSecretEncrypted: string;
  scopes: string[];
  groupClaim?: string;
  roleMappings?: Record<string, string>;
}

export interface IdPRecord {
  id: number;
  name: string;
  enabled: boolean;
  config: IdPConfig;
}

export function getIdPById(id: number): IdPRecord | null {
  const db = getDb();
  const row = db
    .query(
      'SELECT id, name, enabled, config_json FROM identity_providers WHERE id = ? AND enabled = 1'
    )
    .get(id) as { id: number; name: string; enabled: number; config_json: string } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled === 1,
    config: JSON.parse(row.config_json) as IdPConfig,
  };
}

export async function discoverIssuer(issuerUrl: string): Promise<oauth.AuthorizationServer> {
  const issuer = new URL(issuerUrl);
  const response = await oauth.discoveryRequest(issuer, { algorithm: 'oidc' });
  return oauth.processDiscoveryResponse(issuer, response);
}

export function buildAuthorizeUrl(
  as: oauth.AuthorizationServer,
  config: IdPConfig,
  redirectUri: string,
  state: string,
  codeChallenge: string,
  nonce: string
): URL {
  const authorizationEndpoint = as.authorization_endpoint;
  if (!authorizationEndpoint) {
    throw new Error('Authorization server does not have an authorization endpoint');
  }
  const url = new URL(authorizationEndpoint);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('response_type', 'code');
  return url;
}

export async function exchangeCode(
  as: oauth.AuthorizationServer,
  config: IdPConfig,
  redirectUri: string,
  code: string,
  codeVerifier: string,
  nonce: string
): Promise<{ idToken: string; accessToken?: string; claims: Record<string, unknown> }> {
  const clientSecret = await decryptSecret(config.clientSecretEncrypted);
  const client: oauth.Client = { client_id: config.clientId };
  const clientAuthentication = oauth.ClientSecretBasic(clientSecret);
  const callbackParameters = new URLSearchParams();
  callbackParameters.set('code', code);
  const response = await oauth.authorizationCodeGrantRequest(
    as,
    client,
    clientAuthentication,
    callbackParameters,
    redirectUri,
    codeVerifier
  );
  const result = await oauth.processAuthorizationCodeResponse(as, client, response, {
    expectedNonce: nonce,
    requireIdToken: true,
  });
  if (!result.id_token) throw new Error('ID token missing from authorization response');
  const claims = oauth.getValidatedIdTokenClaims(result);
  if (!claims) throw new Error('ID token validation failed');
  return {
    idToken: result.id_token,
    accessToken: result.access_token,
    claims: claims as Record<string, unknown>,
  };
}
