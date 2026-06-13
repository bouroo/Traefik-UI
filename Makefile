.PHONY: help dev build test test-integration test-e2e lint typecheck format clean container-build container-up container-down container-logs

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev: ## Start development servers
	bun run dev

build: ## Build all packages
	bun run build

test: ## Run all unit tests
	bun run test

test-integration: ## Run integration tests (requires podman/docker)
	./scripts/test-integration.sh

test-e2e: ## Run E2E tests (starts dev servers automatically)
	cd packages/frontend && bun run e2e

test-e2e-container: ## Run E2E tests against containerized stack
	./scripts/test-e2e-container.sh

lint: ## Lint all packages
	bun run lint

typecheck: ## Type check all packages
	bun run typecheck

format: ## Format all code
	bun run format

format-check: ## Check formatting
	bun run format:check

clean: ## Clean build artifacts
	rm -rf packages/backend/dist packages/frontend/dist .turbo node_modules/.cache

container-build: ## Build container image
	podman build -f Containerfile -t traefik-ui:latest .

container-up: ## Start container stack
	podman compose up -d

container-down: ## Stop container stack
	podman compose down

container-logs: ## Follow container logs
	podman compose logs -f
