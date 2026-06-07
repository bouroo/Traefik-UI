import { Hono } from 'hono';
import { getDb } from '../../db';
import { encryptSecret } from '../../lib/crypto';
import { authMiddleware } from '../../auth/middleware';
import { requirePermission } from '../../auth/rbac';
import { getIdPById } from '../../auth/oidc';

const ssoProviders = new Hono();

ssoProviders.use('/*', authMiddleware);

ssoProviders.get('/', requirePermission('system.idp.read'), async (c) => {
  const db = getDb();
  const rows = db
    .query(
      'SELECT id, name, provider_type, enabled, created_at, updated_at FROM identity_providers ORDER BY id'
    )
    .all() as {
    id: number;
    name: string;
    provider_type: string;
    enabled: number;
    created_at: string;
    updated_at: string;
  }[];
  return c.json(rows);
});

ssoProviders.get('/:id', requirePermission('system.idp.read'), async (c) => {
  const id = parseInt(c.req.param('id') || '');
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }
  const idp = getIdPById(id);
  if (!idp) {
    return c.json({ error: 'Identity provider not found' }, 404);
  }
  const { clientSecretEncrypted: _clientSecretEncrypted, ...configWithoutSecret } = idp.config;
  return c.json({
    id: idp.id,
    name: idp.name,
    provider_type: 'oidc',
    enabled: idp.enabled,
    config: configWithoutSecret,
  });
});

ssoProviders.post('/', requirePermission('system.idp.write'), async (c) => {
  let body: {
    name: string;
    provider_type: string;
    enabled?: boolean;
    config: {
      issuerUrl: string;
      clientId: string;
      clientSecret: string;
      scopes?: string[];
      groupClaim?: string;
      roleMappings?: Record<string, string>;
    };
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const { name, provider_type, enabled = true, config: configBody } = body;

  if (!name || !provider_type || !configBody) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  if (provider_type !== 'oidc') {
    return c.json({ error: 'Only provider_type=oidc is supported' }, 400);
  }

  if (!configBody.issuerUrl || !configBody.clientId || !configBody.clientSecret) {
    return c.json(
      { error: 'Missing required config fields: issuerUrl, clientId, clientSecret' },
      400
    );
  }

  const encryptedSecret = await encryptSecret(configBody.clientSecret);
  const configJson = JSON.stringify({
    issuerUrl: configBody.issuerUrl,
    clientId: configBody.clientId,
    clientSecretEncrypted: encryptedSecret,
    scopes: configBody.scopes || ['openid', 'profile', 'email'],
    groupClaim: configBody.groupClaim || 'groups',
    roleMappings: configBody.roleMappings || {},
  });

  const db = getDb();
  const result = db.run(
    'INSERT INTO identity_providers (name, provider_type, enabled, config_json) VALUES (?, ?, ?, ?)',
    [name, provider_type, enabled ? 1 : 0, configJson]
  );
  const id = Number(result.lastInsertRowid);

  return c.json({ id, name }, 201);
});

ssoProviders.put('/:id', requirePermission('system.idp.write'), async (c) => {
  const id = parseInt(c.req.param('id') || '');
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  const db = getDb();
  const existing = db.query('SELECT * FROM identity_providers WHERE id = ?').get(id) as
    | {
        id: number;
        name: string;
        enabled: number;
        config_json: string;
      }
    | undefined;

  if (!existing) {
    return c.json({ error: 'Identity provider not found' }, 404);
  }

  let body: {
    name?: string;
    enabled?: boolean;
    config?: {
      issuerUrl?: string;
      clientId?: string;
      clientSecret?: string;
      scopes?: string[];
      groupClaim?: string;
      roleMappings?: Record<string, string>;
    };
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const existingConfig = JSON.parse(existing.config_json);

  const newConfig = {
    issuerUrl: body.config?.issuerUrl ?? existingConfig.issuerUrl,
    clientId: body.config?.clientId ?? existingConfig.clientId,
    clientSecretEncrypted: existingConfig.clientSecretEncrypted,
    scopes: body.config?.scopes ?? existingConfig.scopes ?? ['openid', 'profile', 'email'],
    groupClaim: body.config?.groupClaim ?? existingConfig.groupClaim ?? 'groups',
    roleMappings: body.config?.roleMappings ?? existingConfig.roleMappings ?? {},
  };

  if (body.config?.clientSecret) {
    newConfig.clientSecretEncrypted = await encryptSecret(body.config.clientSecret);
  }

  const newConfigJson = JSON.stringify(newConfig);
  const newName = body.name ?? existing.name;
  const newEnabled = body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing.enabled;

  db.run(
    'UPDATE identity_providers SET name = ?, enabled = ?, config_json = ?, updated_at = datetime("now") WHERE id = ?',
    [newName, newEnabled, newConfigJson, id]
  );

  return c.json({ id, name: newName });
});

ssoProviders.delete('/:id', requirePermission('system.idp.write'), async (c) => {
  const id = parseInt(c.req.param('id') || '');
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  const db = getDb();
  const existing = db.query('SELECT id FROM identity_providers WHERE id = ?').get(id);
  if (!existing) {
    return c.json({ error: 'Identity provider not found' }, 404);
  }

  db.run('DELETE FROM identity_providers WHERE id = ?', [id]);
  return c.json({ success: true });
});

export { ssoProviders };
