import { Hono } from 'hono';
import * as traefik from '../traefik/client';
import { authMiddleware } from '../auth/middleware';

const middlewares = new Hono();

middlewares.use('*', authMiddleware);

middlewares.get('/', async (c) => {
  try {
    const [httpMiddlewares, tcpMiddlewares] = await Promise.all([
      traefik.getHttpMiddlewares(),
      traefik.getTcpMiddlewares(),
    ]);

    return c.json({
      http: httpMiddlewares,
      tcp: tcpMiddlewares,
    });
  } catch (error) {
    console.error('[middlewares] Error fetching all middlewares:', error);
    return c.json({ error: 'Internal server error while fetching middlewares' }, 500);
  }
});

middlewares.get('/http', async (c) => {
  try {
    const middlewares = await traefik.getHttpMiddlewares();
    return c.json(middlewares);
  } catch (error) {
    console.error('[middlewares] Error fetching HTTP middlewares:', error);
    return c.json({ error: 'Internal server error while fetching HTTP middlewares' }, 500);
  }
});

middlewares.get('/http/:name', async (c) => {
  try {
    const name = c.req.param('name');
    const middleware = await traefik.getHttpMiddleware(name);

    if (middleware === null) {
      return c.json({ error: 'Middleware not found' }, 404);
    }

    return c.json(middleware);
  } catch (error) {
    console.error('[middlewares] Error fetching HTTP middleware:', error);
    return c.json({ error: 'Internal server error while fetching HTTP middleware' }, 500);
  }
});

middlewares.get('/tcp', async (c) => {
  try {
    const middlewares = await traefik.getTcpMiddlewares();
    return c.json(middlewares);
  } catch (error) {
    console.error('[middlewares] Error fetching TCP middlewares:', error);
    return c.json({ error: 'Internal server error while fetching TCP middlewares' }, 500);
  }
});

middlewares.get('/tcp/:name', async (c) => {
  try {
    const name = c.req.param('name');
    const middleware = await traefik.getTcpMiddleware(name);

    if (middleware === null) {
      return c.json({ error: 'Middleware not found' }, 404);
    }

    return c.json(middleware);
  } catch (error) {
    console.error('[middlewares] Error fetching TCP middleware:', error);
    return c.json({ error: 'Internal server error while fetching TCP middleware' }, 500);
  }
});

export { middlewares };
