# Managing Resources

Traefik-UI surfaces everything via the registry-driven generic API. Pages are grouped by what they manage — protocols (HTTP, TCP, UDP), TLS, logs, system, and config files.

## Dashboard

The landing page after login shows live counts pulled from Traefik's API: HTTP routers, services, middlewares, entrypoints, plus a Traefik info card, a routers-by-protocol bar chart, and a resources-by-protocol table.

Screenshot: `docs/screenshots/dashboard.png` (see the README's [Screenshots](../README.md#screenshots) section).

## Routers, services, middlewares

Routers, services, and middlewares are exposed across all three protocols. Each resource page has tabs for HTTP / TCP / UDP; the underlying route is the same generic endpoint (`/api/:resourceType/:protocol`) — the protocol/resource registry decides which Tab is available.

The screenshots below show each protocol's table view:

- Routers: `docs/screenshots/routers-http.png`, `docs/screenshots/routers-tcp.png`, `docs/screenshots/routers-udp.png`
- Services: `docs/screenshots/services-http.png`, `docs/screenshots/services-tcp.png`
- Middlewares: `docs/screenshots/middlewares.png`

Inspect a resource to see its full configuration and which related resources (services referenced by a router, middlewares applied, etc.) are wired together. Mutations to live Traefik state go through the dynamic config file; see [[#Config file viewer & editor]].

## TLS certificates

Browse ACME certificates and TLS options exposed by Traefik. The UI reads from `ACME_JSON_PATH` (see [[Configuration]]) and falls back to the Traefik API when the file is unreadable. Screenshot: `docs/screenshots/tls.png`.

## Entrypoints

List every entrypoint Traefik is listening on (web, websecure, tcp, tcpsecure, udp, dns, traefik, etc.). Screenshot: `docs/screenshots/entrypoints.png`.

## Access logs

Read access logs straight from the file at `ACCESS_LOG_PATH`. Both Common Log Format and JSON formats are auto-detected, and the viewer supports filtering. Screenshot: `docs/screenshots/logs.png`.

## System monitoring

Live CPU, memory, uptime, and disk metrics for the host running Traefik-UI. Screenshot: `docs/screenshots/system.png`.

## Config file viewer & editor

When `STATIC_CONFIG_PATH` and/or `DYNAMIC_CONFIG_PATH` are set, the config file page renders the YAML as a JSON tree (toggle `?raw=true` to view raw YAML), and lets you:

- **View** the parsed structure
- **Edit** YAML in place
- **Validate** against the Traefik JSON Schema (POST `/api/configfile/validate`)
- **Format** / parse-and-re-serialize cleanly (POST `/api/configfile/format`)

Edits are written back to the file on the host, so the path must be mounted **read-write**. Screenshot: `docs/screenshots/configfile.png`.

> Screenshot paths above are relative to the main repo (`docs/screenshots/...`). On the GitHub wiki, replace `docs/` with the full URL to your repo's main branch if you want to embed them inline; otherwise link out to the README's [Screenshots section](../README.md#screenshots).
