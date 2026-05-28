import { Hono } from 'hono';
import * as traefik from '../traefik/client';
import { authMiddleware } from '../auth/middleware';

const overview = new Hono();

overview.use('*', authMiddleware);

overview.get('/', async (c) => {
  try {
    const data = await traefik.getOverview();

    if (data === null) {
      return c.json({ error: 'Failed to fetch overview from Traefik API' }, 503);
    }

    return c.json(data);
  } catch (error) {
    console.error('[overview] Error fetching overview:', error);
    return c.json({ error: 'Internal server error while fetching overview' }, 500);
  }
});

overview.get('/raw', async (c) => {
  try {
    const data = await traefik.getRawData();

    if (data === null) {
      return c.json({ error: 'Failed to fetch raw data from Traefik API' }, 503);
    }

    return c.json(data);
  } catch (error) {
    console.error('[overview] Error fetching raw data:', error);
    return c.json({ error: 'Internal server error while fetching raw data' }, 500);
  }
});

overview.get('/version', async (c) => {
  try {
    const data = await traefik.getVersion();

    if (data === null) {
      return c.json({ error: 'Failed to fetch version info from Traefik API' }, 503);
    }

    return c.json(data);
  } catch (error) {
    console.error('[overview] Error fetching version:', error);
    return c.json({ error: 'Internal server error while fetching version' }, 500);
  }
});

export { overview };
