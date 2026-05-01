// Protocol and resource type registry for Traefik's API
// Adding a new protocol or resource type only requires data changes here.

export interface AssociatedResource {
  /** The resource type this entity links to */
  resourceType: string;
  /** The field name on the entity that references it */
  field: string;
  /** Whether the field holds a single name or an array of names */
  isArray: boolean;
}

export interface ResourceTypeConfig {
  /** Plural name used in API paths: 'routers', 'services', 'middlewares' */
  name: string;
  /** Singular name used in detail paths: 'router', 'service', 'middleware' */
  singular: string;
  /** Human-readable display name */
  displayName: string;
  /** Resources linked from this entity's detail view (e.g., routers link to services and middlewares) */
  associatedResources?: AssociatedResource[];
  /** Icon for the sidebar (remixicon class) */
  icon: string;
  /** Whether this resource type should appear in the nav */
  navVisible: boolean;
}

export interface ProtocolConfig {
  /** Protocol name used in Traefik API paths: 'http', 'tcp', 'udp' */
  name: string;
  /** Resource types this protocol supports */
  resourceTypes: string[];
}

/** All known resource type configurations */
export const RESOURCE_TYPES: Record<string, ResourceTypeConfig> = {
  routers: {
    name: 'routers',
    singular: 'router',
    displayName: 'Routers',
    icon: 'ri-share-forward-line',
    navVisible: true,
    associatedResources: [
      { resourceType: 'services', field: 'service', isArray: false },
      { resourceType: 'middlewares', field: 'middlewares', isArray: true },
    ],
  },
  services: {
    name: 'services',
    singular: 'service',
    displayName: 'Services',
    icon: 'ri-server-line',
    navVisible: true,
  },
  middlewares: {
    name: 'middlewares',
    singular: 'middleware',
    displayName: 'Middlewares',
    icon: 'ri-stack-line',
    navVisible: true,
  },
};

/** All known protocol configurations */
export const PROTOCOLS: ProtocolConfig[] = [
  { name: 'http', resourceTypes: ['routers', 'services', 'middlewares'] },
  { name: 'tcp', resourceTypes: ['routers', 'services', 'middlewares'] },
  { name: 'udp', resourceTypes: ['routers', 'services'] },
];

/** Get protocols that support a given resource type */
export function getProtocolsForResource(resourceType: string): ProtocolConfig[] {
  return PROTOCOLS.filter((p) => p.resourceTypes.includes(resourceType));
}

/** Get the resource type config, or undefined if not found */
export function getResourceConfig(resourceType: string): ResourceTypeConfig | undefined {
  return RESOURCE_TYPES[resourceType];
}

/** All resource type keys that appear in the navigation */
export const NAV_RESOURCE_TYPES = Object.values(RESOURCE_TYPES)
  .filter((rt) => rt.navVisible)
  .map((rt) => rt.name);
