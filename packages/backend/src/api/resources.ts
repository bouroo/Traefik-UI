import { Hono } from 'hono';
import * as traefik from '../traefik/client';
import { authMiddleware } from '../auth/middleware';
import { requireResourcePermission } from '../auth/rbac';
import {
  getResourceConfig,
  getProtocolsForResource,
  RESOURCE_TYPES,
  type AssociatedResource,
  type ProtocolConfig,
  type ResourceTypeConfig,
} from '../traefik/registry';

function isProtocolSupportingResource(protocolName: string, resourceType: string): boolean {
  return getProtocolsForResource(resourceType).some((p) => p.name === protocolName);
}

const resources = new Hono();

resources.use('*', authMiddleware);

const RESOURCE_TYPE_PATTERN = Object.keys(RESOURCE_TYPES).join('|');

resources.get(
  `/:resourceType{${RESOURCE_TYPE_PATTERN}}/:protocol`,
  requireResourcePermission('resourceType'),
  async (c) => {
    const resourceType = c.req.param('resourceType') as string;
    const protocol = c.req.param('protocol') as string;

    try {
      const resourceConfig: ResourceTypeConfig | undefined = getResourceConfig(resourceType);
      if (!resourceConfig) {
        return c.json({ error: 'Unknown resource type' }, 404);
      }

      if (!isProtocolSupportingResource(protocol, resourceType)) {
        return c.json({ error: `${protocol} does not support ${resourceType}` }, 404);
      }

      const items = await traefik.getAllResources(protocol, resourceType);
      if (resourceConfig.wrapResponse === false) {
        return c.json(items);
      }

      return c.json({ [resourceConfig.name]: items });
    } catch (error) {
      console.error(`[resources] Failed to fetch ${protocol}/${resourceType}:`, error);
      return c.json({ error: `Failed to fetch ${protocol} ${resourceType}` }, 500);
    }
  }
);

resources.get(
  `/:resourceType{${RESOURCE_TYPE_PATTERN}}/:protocol/:name`,
  requireResourcePermission('resourceType'),
  async (c) => {
    const resourceType = c.req.param('resourceType') as string;
    const protocol = c.req.param('protocol') as string;
    const name = c.req.param('name') as string;

    try {
      const resourceConfig: ResourceTypeConfig | undefined = getResourceConfig(resourceType);
      if (!resourceConfig) {
        return c.json({ error: 'Unknown resource type' }, 404);
      }

      if (!isProtocolSupportingResource(protocol, resourceType)) {
        return c.json({ error: `${protocol} does not support ${resourceType}` }, 404);
      }

      const item = await traefik.getOneResource(protocol, resourceType, name);

      if (!item) {
        return c.json({ error: `${resourceConfig.singular} not found` }, 404);
      }

      const associatedResources: AssociatedResource[] = resourceConfig.associatedResources || [];

      type FetchTask = {
        promise: Promise<unknown>;
        assoc: AssociatedResource;
      };

      const fetchTasks: FetchTask[] = [];

      for (const assoc of associatedResources) {
        const value = (item as Record<string, unknown>)[assoc.field];
        if (value === undefined || value === null) continue;

        if (assoc.isArray && Array.isArray(value)) {
          for (const nameValue of value) {
            if (typeof nameValue === 'string') {
              fetchTasks.push({
                promise: traefik.getOneResource(protocol, assoc.resourceType, nameValue),
                assoc,
              });
            }
          }
        } else if (typeof value === 'string') {
          fetchTasks.push({
            promise: traefik.getOneResource(protocol, assoc.resourceType, value),
            assoc,
          });
        }
      }

      const fetchResults = await Promise.allSettled(fetchTasks.map((t) => t.promise));

      const associated: Record<string, unknown> = {};
      for (const assoc of associatedResources) {
        if (assoc.isArray) {
          associated[assoc.field] = [];
        }
      }

      for (let i = 0; i < fetchResults.length; i++) {
        const result = fetchResults[i];
        const task = fetchTasks[i];
        if (result.status === 'fulfilled' && result.value !== null && result.value !== undefined) {
          if (task.assoc.isArray) {
            (associated[task.assoc.field] as unknown[]).push(result.value);
          } else {
            associated[task.assoc.field] = result.value;
          }
        }
      }

      if (resourceConfig.wrapResponse === false) {
        return c.json(item);
      }

      return c.json({ [resourceConfig.singular]: item, ...associated });
    } catch (error) {
      console.error(`[resources] Failed to fetch ${protocol}/${resourceType}/${name}:`, error);
      return c.json({ error: `Failed to fetch ${resourceType} detail` }, 500);
    }
  }
);

resources.get(
  `/:resourceType{${RESOURCE_TYPE_PATTERN}}`,
  requireResourcePermission('resourceType'),
  async (c) => {
    const resourceType = c.req.param('resourceType') as string;
    try {
      const protocols: ProtocolConfig[] = getProtocolsForResource(resourceType);

      const results = await Promise.allSettled(
        protocols.map((p: ProtocolConfig) => traefik.getAllResources(p.name, resourceType))
      );

      const response: Record<string, unknown[]> = {};
      protocols.forEach((protocol: ProtocolConfig, index: number) => {
        const result = results[index];
        response[protocol.name] = result.status === 'fulfilled' ? result.value : [];
      });

      return c.json(response);
    } catch (error) {
      console.error(`[resources] Failed to fetch ${resourceType}:`, error);
      return c.json({ error: `Failed to fetch ${resourceType}` }, 500);
    }
  }
);

export { resources };