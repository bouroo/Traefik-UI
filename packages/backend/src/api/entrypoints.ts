import { Hono } from 'hono';
import * as traefik from '../traefik/client';
import { authMiddleware } from '../auth/middleware';

const entrypoints = new Hono();

entrypoints.use('*', authMiddleware);

// GET /api/entrypoints
// Returns all Traefik entrypoints
entrypoints.get('/', async (c) => {
  try {
    const eps = await traefik.getEntryPoints();

    if (!eps) {
      console.error('[entrypoints] Failed to fetch entrypoints: API returned null');
      return c.json({ error: 'Failed to fetch entrypoints from Traefik API' }, 502);
    }

    return c.json({ entrypoints: eps });
  } catch (error) {
    console.error(
      '[entrypoints] Error fetching entrypoints:',
      error instanceof Error ? error.message : String(error)
    );
    return c.json({ error: 'Internal server error while fetching entrypoints' }, 500);
  }
});

// GET /api/entrypoints/:name
// Returns single entrypoint detail
entrypoints.get('/:name', async (c) => {
  const name = c.req.param('name');

  if (!name) {
    return c.json({ error: 'Entrypoint name is required' }, 400);
  }

  try {
    const ep = await traefik.getEntryPoint(name);

    if (!ep) {
      return c.json({ error: 'Entrypoint not found' }, 404);
    }

    return c.json({ entrypoint: ep });
  } catch (error) {
    console.error(
      `[entrypoints] Error fetching entrypoint "${name}":`,
      error instanceof Error ? error.message : String(error)
    );
    return c.json({ error: 'Internal server error while fetching entrypoint' }, 500);
  }
});

export { entrypoints };
