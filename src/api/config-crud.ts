import { Hono } from 'hono';
import { YAML } from 'bun';
import { config } from '../config';
import { authMiddleware } from '../auth/middleware';

const configCrud = new Hono();

configCrud.use('*', authMiddleware);

// ── Helper: read dynamic config YAML, return parsed object ──
async function readDynamicConfig(): Promise<Record<string, unknown>> {
  const filePath = config.paths.dynamicConfig;
  if (!filePath) {
    throw new Error('Dynamic config path not configured');
  }
  if (!(await Bun.file(filePath).exists())) {
    return {};
  }
  const content = await Bun.file(filePath).text();
  return YAML.parse(content) as Record<string, unknown>;
}

// ── Helper: serialize and write dynamic config YAML ──
async function writeDynamicConfig(data: Record<string, unknown>): Promise<void> {
  const filePath = config.paths.dynamicConfig;
  if (!filePath) {
    throw new Error('Dynamic config path not configured');
  }
  const yamlContent = YAML.stringify(data, null, 2);
  await Bun.write(filePath, yamlContent);
}

// ── Type definitions ──
interface ResourceParams {
  protocol: string;   // 'http', 'tcp', 'udp'
  resourceType: string; // 'routers', 'services', 'middlewares'
  name: string;
}

// Ensure nested structure exists
function ensurePath(obj: Record<string, unknown>, ...keys: string[]): Record<string, unknown> {
  let current = obj;
  for (const key of keys) {
    if (!current[key]) {
      current[key] = {} as Record<string, unknown>;
    }
    current = current[key] as Record<string, unknown>;
  }
  return current;
}

// Strip @provider suffix from resource names (e.g., "demo-service@file" → "demo-service")
function stripProviderSuffix(name: string | undefined): string {
  if (!name) return '';
  const idx = name.indexOf('@');
  return idx > 0 ? name.substring(0, idx) : name;
}

// ── POST /api/config-crud/:resourceType  (create/update a resource) ──
// Body: { protocol: "http", name: "my-resource", data: { ... } }
// Creates or updates a resource entry in the dynamic config
configCrud.post('/:resourceType', async (c) => {
  const resourceType = c.req.param('resourceType') as string;
  
  // Validate resource type
  if (!['routers', 'services', 'middlewares'].includes(resourceType)) {
    return c.json({ error: `Invalid resource type: ${resourceType}. Valid: routers, services, middlewares` }, 400);
  }

  let body: { protocol?: string; name?: string; data?: Record<string, unknown> };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { protocol, name: rawName, data } = body;
  const name = stripProviderSuffix(rawName);

  if (!protocol || !name || !data) {
    return c.json({ error: 'Missing required fields: protocol, name, data' }, 400);
  }
  
  if (!['http', 'tcp', 'udp'].includes(protocol)) {
    return c.json({ error: `Invalid protocol: ${protocol}` }, 400);
  }

  // UDP doesn't have middlewares, TCP/UDP don't have all resource types
  if (resourceType === 'middlewares' && protocol === 'udp') {
    return c.json({ error: 'UDP does not support middlewares' }, 400);
  }

  try {
    const configData = await readDynamicConfig();
    
    // Navigate to the section: protocol.resourceType
    ensurePath(configData, protocol, resourceType);
    const section = (configData[protocol] as Record<string, unknown>)[resourceType] as Record<string, unknown>;
    
    // Set the resource entry
    section[name] = data;
    
    await writeDynamicConfig(configData);
    
    return c.json({
      success: true,
      message: `${resourceType.slice(0, -1)} '${name}' saved. Traefik will reload automatically.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[config-crud] Error saving ${resourceType}:`, message);
    return c.json({ error: message }, 500);
  }
});

// ── DELETE /api/config-crud/:resourceType/:protocol/:name ──
configCrud.delete('/:resourceType/:protocol/:name', async (c) => {
  const resourceType = c.req.param('resourceType') as string;
  const protocol = c.req.param('protocol') as string;
  const rawName = decodeURIComponent(c.req.param('name') as string);
  const name = stripProviderSuffix(rawName);

  if (!['routers', 'services', 'middlewares'].includes(resourceType)) {
    return c.json({ error: `Invalid resource type: ${resourceType}` }, 400);
  }

  try {
    const configData = await readDynamicConfig();
    
    const protocolSection = configData[protocol] as Record<string, unknown> | undefined;
    if (!protocolSection) {
      return c.json({ error: `Protocol '${protocol}' not found in config` }, 404);
    }
    
    const resourceSection = protocolSection[resourceType] as Record<string, unknown> | undefined;
    if (!resourceSection || !resourceSection[name]) {
      return c.json({ error: `${resourceType.slice(0, -1)} '${name}' not found in ${protocol}` }, 404);
    }
    
    delete resourceSection[name];
    
    // Clean up empty sections
    if (Object.keys(resourceSection).length === 0) {
      delete protocolSection[resourceType];
    }
    if (Object.keys(protocolSection).length === 0) {
      delete configData[protocol];
    }
    
    await writeDynamicConfig(configData);
    
    return c.json({
      success: true,
      message: `${resourceType.slice(0, -1)} '${name}' deleted. Traefik will reload automatically.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[config-crud] Error deleting ${resourceType}:`, message);
    return c.json({ error: message }, 500);
  }
});

// ── GET /api/config-crud/:resourceType?protocol=http ──
// Returns only the resources from the dynamic config YAML (not from Traefik API)
// Useful for the edit forms to know what's already defined in the config file
configCrud.get('/:resourceType', async (c) => {
  const resourceType = c.req.param('resourceType') as string;
  const protocol = c.req.query('protocol');

  if (!['routers', 'services', 'middlewares'].includes(resourceType)) {
    return c.json({ error: `Invalid resource type: ${resourceType}` }, 400);
  }

  try {
    const configData = await readDynamicConfig();
    
    if (protocol) {
      const section = (configData[protocol] as Record<string, unknown>)?.[resourceType];
      return c.json(section || {});
    }
    
    // Return all protocols
    const result: Record<string, unknown> = {};
    for (const p of ['http', 'tcp', 'udp']) {
      const section = (configData[p] as Record<string, unknown>)?.[resourceType];
      if (section) {
        result[p] = section;
      }
    }
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 500);
  }
});

export { configCrud };
