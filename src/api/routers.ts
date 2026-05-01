import { Hono } from 'hono';
import * as traefik from '../traefik/client';
import { authMiddleware } from '../auth/middleware';

const routers = new Hono();

routers.use('*', authMiddleware);

routers.get('/', async (c) => {
  try {
    const [httpResult, tcpResult, udpResult] = await Promise.allSettled([
      traefik.getHttpRouters(),
      traefik.getTcpRouters(),
      traefik.getUdpRouters(),
    ]);

    const http = httpResult.status === 'fulfilled' ? httpResult.value : [];
    const tcp = tcpResult.status === 'fulfilled' ? tcpResult.value : [];
    const udp = udpResult.status === 'fulfilled' ? udpResult.value : [];

    return c.json({ http, tcp, udp });
  } catch (error) {
    console.error('Failed to fetch routers:', error);
    return c.json({ error: 'Failed to fetch routers' }, 500);
  }
});

routers.get('/http', async (c) => {
  try {
    const routers = await traefik.getHttpRouters();
    return c.json({ routers });
  } catch (error) {
    console.error('Failed to fetch HTTP routers:', error);
    return c.json({ error: 'Failed to fetch HTTP routers' }, 500);
  }
});

routers.get('/http/:name', async (c) => {
  try {
    const name = c.req.param('name');
    const router = await traefik.getHttpRouter(name);

    if (!router) {
      return c.json({ error: 'Router not found' }, 404);
    }

    const [serviceResult, middlewaresResult] = await Promise.allSettled([
      router.service ? traefik.getHttpService(router.service) : Promise.resolve(null),
      Promise.all((router.middlewares || []).map((m) => traefik.getHttpMiddleware(m))),
    ]);

    const service = serviceResult.status === 'fulfilled' ? serviceResult.value : null;
    const middlewares =
      middlewaresResult.status === 'fulfilled'
        ? middlewaresResult.value.filter((m) => m !== null)
        : [];

    return c.json({ router, service, middlewares });
  } catch (error) {
    console.error('Failed to fetch HTTP router detail:', error);
    return c.json({ error: 'Failed to fetch HTTP router detail' }, 500);
  }
});

routers.get('/tcp', async (c) => {
  try {
    const routers = await traefik.getTcpRouters();
    return c.json({ routers });
  } catch (error) {
    console.error('Failed to fetch TCP routers:', error);
    return c.json({ error: 'Failed to fetch TCP routers' }, 500);
  }
});

routers.get('/tcp/:name', async (c) => {
  try {
    const name = c.req.param('name');
    const router = await traefik.fetchTraefik<traefik.TraefikRouter>(
      `/tcp/routers/${encodeURIComponent(name)}`
    );

    if (!router) {
      return c.json({ error: 'Router not found' }, 404);
    }

    const [serviceResult, middlewaresResult] = await Promise.allSettled([
      router.service
        ? traefik.fetchTraefik<traefik.TraefikService>(
            `/tcp/services/${encodeURIComponent(router.service)}`
          )
        : Promise.resolve(null),
      Promise.all((router.middlewares || []).map((m) => traefik.getTcpMiddleware(m))),
    ]);

    const service = serviceResult.status === 'fulfilled' ? serviceResult.value : null;
    const middlewares =
      middlewaresResult.status === 'fulfilled'
        ? middlewaresResult.value.filter((m) => m !== null)
        : [];

    return c.json({ router, service, middlewares });
  } catch (error) {
    console.error('Failed to fetch TCP router detail:', error);
    return c.json({ error: 'Failed to fetch TCP router detail' }, 500);
  }
});

routers.get('/udp', async (c) => {
  try {
    const routers = await traefik.getUdpRouters();
    return c.json({ routers });
  } catch (error) {
    console.error('Failed to fetch UDP routers:', error);
    return c.json({ error: 'Failed to fetch UDP routers' }, 500);
  }
});

routers.get('/udp/:name', async (c) => {
  try {
    const name = c.req.param('name');
    const router = await traefik.fetchTraefik<traefik.TraefikRouter>(
      `/udp/routers/${encodeURIComponent(name)}`
    );

    if (!router) {
      return c.json({ error: 'Router not found' }, 404);
    }

    const serviceResult = await Promise.allSettled([
      router.service
        ? traefik.fetchTraefik<traefik.TraefikService>(
            `/udp/services/${encodeURIComponent(router.service)}`
          )
        : Promise.resolve(null),
    ]);

    const service = serviceResult[0].status === 'fulfilled' ? serviceResult[0].value : null;

    return c.json({ router, service });
  } catch (error) {
    console.error('Failed to fetch UDP router detail:', error);
    return c.json({ error: 'Failed to fetch UDP router detail' }, 500);
  }
});

export { routers };
