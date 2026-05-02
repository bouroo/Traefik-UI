import { Hono } from 'hono';
import { YAML } from 'bun';
import Ajv from 'ajv';
import { config } from '../config';
import { authMiddleware } from '../auth/middleware';

const configfile = new Hono();

configfile.use('*', authMiddleware);

// GET /api/configfile/static
// Reads the Traefik static configuration YAML file. Returns parsed JSON by default,
// or raw YAML text when ?raw=true.
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
    
    // If raw mode requested, return YAML text directly
    if (c.req.query('raw') === 'true') {
      return c.text(content);
    }
    
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

// PUT /api/configfile/static
// Updates the Traefik static configuration YAML file. Accepts raw YAML text in the request body.
// Validates the YAML is parseable before writing.
configfile.put('/static', async (c) => {
  const filePath = config.paths.staticConfig;

  if (!filePath) {
    return c.json(
      { error: 'Static config path not configured. Set STATIC_CONFIG_PATH env var.' },
      404
    );
  }

  // Read raw body as text (YAML)
  let body: string;
  try {
    body = await c.req.text();
  } catch {
    return c.json({ error: 'Failed to read request body' }, 400);
  }

  if (!body || body.trim().length === 0) {
    return c.json({ error: 'Request body is empty' }, 400);
  }

  // Validate YAML is parseable
  try {
    YAML.parse(body);
  } catch (error) {
    return c.json({
      error: 'Invalid YAML syntax',
      details: error instanceof Error ? error.message : String(error),
    }, 400);
  }

  // Write to file
  try {
    await Bun.write(filePath, body);
  } catch (error) {
    console.error(
      '[configfile] Error writing static config:',
      error instanceof Error ? error.message : String(error)
    );
    return c.json({ error: 'Failed to write config file' }, 500);
  }

  return c.json({
    success: true,
    message: 'Static config updated. Note: Traefik may require a restart for static config changes.',
  });
});

// GET /api/configfile/dynamic
// Reads the Traefik dynamic configuration YAML file. Returns parsed JSON by default,
// or raw YAML text when ?raw=true.
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
    
    // If raw mode requested, return YAML text directly
    if (c.req.query('raw') === 'true') {
      return c.text(content);
    }
    
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

// PUT /api/configfile/dynamic
// Updates the Traefik dynamic configuration YAML file. Accepts raw YAML text in the request body.
// Validates the YAML is parseable before writing.
configfile.put('/dynamic', async (c) => {
  const filePath = config.paths.dynamicConfig;

  if (!filePath) {
    return c.json(
      { error: 'Dynamic config path not configured. Set DYNAMIC_CONFIG_PATH env var.' },
      404
    );
  }

  // Read raw body as text (YAML)
  let body: string;
  try {
    body = await c.req.text();
  } catch {
    return c.json({ error: 'Failed to read request body' }, 400);
  }

  if (!body || body.trim().length === 0) {
    return c.json({ error: 'Request body is empty' }, 400);
  }

  // Validate YAML is parseable
  try {
    YAML.parse(body);
  } catch (error) {
    return c.json({
      error: 'Invalid YAML syntax',
      details: error instanceof Error ? error.message : String(error),
    }, 400);
  }

  // Write to file
  try {
    await Bun.write(filePath, body);
  } catch (error) {
    console.error(
      '[configfile] Error writing dynamic config:',
      error instanceof Error ? error.message : String(error)
    );
    return c.json({ error: 'Failed to write config file' }, 500);
  }

  return c.json({
    success: true,
    message: 'Dynamic config updated. Traefik will reload automatically.',
  });
});

// POST /api/configfile/validate
// Validates YAML content against the appropriate Traefik JSON Schema from schemastore.org.
// Body: { yaml: string, type: "dynamic" | "static" }
configfile.post('/validate', async (c) => {
  let body: { yaml?: string; type?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { yaml, type } = body;

  if (!yaml || !type) {
    return c.json({ error: 'Missing required fields: yaml, type' }, 400);
  }

  if (!['dynamic', 'static'].includes(type)) {
    return c.json({ error: 'Type must be "dynamic" or "static"' }, 400);
  }

  // Step 1: Parse YAML
  let parsed: unknown;
  try {
    parsed = YAML.parse(yaml);
  } catch (err) {
    return c.json({
      valid: false,
      errors: [`YAML syntax error: ${err instanceof Error ? err.message : String(err)}`],
    });
  }

  // Step 2: Fetch the JSON Schema
  const schemaUrl = type === 'dynamic'
    ? 'https://www.schemastore.org/traefik-v3-file-provider.json'
    : 'https://www.schemastore.org/traefik-v3.json';

  let schema: Record<string, unknown>;
  try {
    const res = await fetch(schemaUrl);
    if (!res.ok) {
      return c.json({
        valid: false,
        errors: [`Could not fetch schema (HTTP ${res.status}). Skipping schema validation.`],
        yamlValid: true,
      });
    }
    schema = await res.json() as Record<string, unknown>;
  } catch (err) {
    return c.json({
      valid: false,
      errors: [`Schema fetch failed: ${err instanceof Error ? err.message : String(err)}`],
      yamlValid: true,
    });
  }

  // Step 3: Validate against JSON Schema using AJV
  try {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const valid = validate(parsed);

    if (valid) {
      return c.json({
        valid: true,
        errors: [],
      });
    }

    // Format AJV errors into readable messages
    const errors = (validate.errors || []).map((e) => {
      const path = e.instancePath || '(root)';
      return `${path}: ${e.message}`;
    });

    return c.json({
      valid: false,
      errors,
    });
  } catch (err) {
    return c.json({
      valid: false,
      errors: [`Schema compilation error: ${err instanceof Error ? err.message : String(err)}`],
    });
  }
});

// POST /api/configfile/format
// Parses and re-serializes YAML to produce consistently formatted output.
// Body: { yaml: string }
configfile.post('/format', async (c) => {
  let body: { yaml?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { yaml } = body;

  if (!yaml) {
    return c.json({ error: 'Missing required field: yaml' }, 400);
  }

  // Parse YAML
  let parsed: unknown;
  try {
    parsed = YAML.parse(yaml);
  } catch (err) {
    return c.json({
      error: 'YAML syntax error',
      details: err instanceof Error ? err.message : String(err),
    }, 400);
  }

  // Re-serialize with consistent formatting (block-style, 2-space indent)
  const formatted = YAML.stringify(parsed, null, 2);

  return c.json({
    success: true,
    formatted,
  });
});

export { configfile };
