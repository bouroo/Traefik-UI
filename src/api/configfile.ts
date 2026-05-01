import { Hono } from 'hono';
import { YAML } from 'bun';
import { config } from '../config';
import { authMiddleware } from '../auth/middleware';

const configfile = new Hono();

configfile.use('*', authMiddleware);

// GET /api/configfile/static
// Reads the Traefik static configuration YAML file and returns it as parsed JSON.
// Requires STATIC_CONFIG_PATH env var to be set to a valid YAML file path.
configfile.get('/static', async (c) => {
  const filePath = config.paths.staticConfig;

  if (!filePath) {
    return c.json(
      { error: 'Static config path not configured. Set STATIC_CONFIG_PATH env var.' },
      404
    );
  }

  if (!(await Bun.file(filePath).exists())) {
    return c.json({ error: 'Static config file not found', path: filePath }, 404);
  }

  try {
    const content = await Bun.file(filePath).text();
    const parsed = YAML.parse(content);
    return c.json(parsed);
  } catch (error) {
    console.error(
      '[configfile] Error parsing static config YAML:',
      error instanceof Error ? error.message : String(error)
    );
    return c.json({ error: 'Failed to parse config YAML' }, 500);
  }
});

// GET /api/configfile/dynamic
// Reads the Traefik dynamic configuration YAML file and returns it as parsed JSON.
// Requires DYNAMIC_CONFIG_PATH env var to be set to a valid YAML file path.
configfile.get('/dynamic', async (c) => {
  const filePath = config.paths.dynamicConfig;

  if (!filePath) {
    return c.json(
      { error: 'Dynamic config path not configured. Set DYNAMIC_CONFIG_PATH env var.' },
      404
    );
  }

  if (!(await Bun.file(filePath).exists())) {
    return c.json({ error: 'Dynamic config file not found', path: filePath }, 404);
  }

  try {
    const content = await Bun.file(filePath).text();
    const parsed = YAML.parse(content);
    return c.json(parsed);
  } catch (error) {
    console.error(
      '[configfile] Error parsing dynamic config YAML:',
      error instanceof Error ? error.message : String(error)
    );
    return c.json({ error: 'Failed to parse config YAML' }, 500);
  }
});

export { configfile };
