import { Hono } from 'hono';
import * as traefik from '../traefik/client';
import { authMiddleware } from '../auth/middleware';

const services = new Hono();

services.use('*', authMiddleware);

services.get('/', async (c) => {
  try {
    const [httpResult, tcpResult, udpResult] = await Promise.allSettled([
      traefik.getHttpServices(),
      traefik.getTcpServices(),
      traefik.getUdpServices(),
    ]);

    const http = httpResult.status === 'fulfilled' ? httpResult.value : [];
    const tcp = tcpResult.status === 'fulfilled' ? tcpResult.value : [];
    const udp = udpResult.status === 'fulfilled' ? udpResult.value : [];

    return c.json({ http, tcp, udp });
  } catch (error) {
    console.error('Failed to fetch services:', error);
    return c.json({ error: 'Failed to fetch services' }, 500);
  }
});

services.get('/http', async (c) => {
  try {
    const servicesList = await traefik.getHttpServices();
    return c.json({ services: servicesList });
  } catch (error) {
    console.error('Failed to fetch HTTP services:', error);
    return c.json({ error: 'Failed to fetch HTTP services' }, 500);
  }
});

services.get('/http/:name', async (c) => {
  try {
    const name = c.req.param('name');
    const service = await traefik.getHttpService(name);

    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }

    return c.json({ service });
  } catch (error) {
    console.error('Failed to fetch HTTP service detail:', error);
    return c.json({ error: 'Failed to fetch HTTP service detail' }, 500);
  }
});

services.get('/tcp', async (c) => {
  try {
    const servicesList = await traefik.getTcpServices();
    return c.json({ services: servicesList });
  } catch (error) {
    console.error('Failed to fetch TCP services:', error);
    return c.json({ error: 'Failed to fetch TCP services' }, 500);
  }
});

services.get('/tcp/:name', async (c) => {
  try {
    const name = c.req.param('name');
    const service = await traefik.fetchTraefik<traefik.TraefikService>(
      `/tcp/services/${encodeURIComponent(name)}`
    );

    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }

    return c.json({ service });
  } catch (error) {
    console.error('Failed to fetch TCP service detail:', error);
    return c.json({ error: 'Failed to fetch TCP service detail' }, 500);
  }
});

services.get('/udp', async (c) => {
  try {
    const servicesList = await traefik.getUdpServices();
    return c.json({ services: servicesList });
  } catch (error) {
    console.error('Failed to fetch UDP services:', error);
    return c.json({ error: 'Failed to fetch UDP services' }, 500);
  }
});

services.get('/udp/:name', async (c) => {
  try {
    const name = c.req.param('name');
    const service = await traefik.fetchTraefik<traefik.TraefikService>(
      `/udp/services/${encodeURIComponent(name)}`
    );

    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }

    return c.json({ service });
  } catch (error) {
    console.error('Failed to fetch UDP service detail:', error);
    return c.json({ error: 'Failed to fetch UDP service detail' }, 500);
  }
});

export { services };
