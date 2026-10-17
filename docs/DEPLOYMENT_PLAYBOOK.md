# Deployment & Release Pipeline Playbook (Vercel / Docker Compose)

Step-by-step procedures for building, shipping and rolling back the ProofOfHeart frontend. For the
environment matrix and secrets see [DEPLOYMENT_ENVIRONMENTS.md](./DEPLOYMENT_ENVIRONMENTS.md); for
every variable see [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md).

- [Choose a target](#choose-a-target)
- [What the build does](#what-the-build-does)
- [Release flow](#release-flow)
- [Vercel](#vercel)
- [Docker image](#docker-image)
- [Docker Compose](#docker-compose)
- [Pre-release checklist](#pre-release-checklist)
- [Rollback](#rollback)
- [Known gaps](#known-gaps)
- [Troubleshooting](#troubleshooting)

## Choose a target

| Target             | Use it for                                                                   | Config                                                     |
| ------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Vercel**         | Preview and production hosting of the Next.js app                            | Project settings + env vars (no `vercel.json` in the repo) |
| **Docker image**   | Self-hosting / Kubernetes; published to GitHub Container Registry on release | `Dockerfile`                                               |
| **Docker Compose** | Local development in a container                                             | `docker-compose.yml`                                       |

All three run the same Next.js app (`output: "standalone"` in `next.config.ts`) on **Node 22**
(`engines.node >= 22`).

## What the build does

`npm run build` = `node ./scripts/validate-production-build.mjs && next build`.

- The validation script **fails the build when `NEXT_PUBLIC_USE_MOCKS=true`**. Set it to `false`,
  or `SKIP_MOCK_CHECK=true` for a deliberate test build. This is the only check it performs today
  (see [Known gaps](#known-gaps)).
- `NEXT_PUBLIC_*` variables are **inlined into the client bundle at build time**. Changing one
  requires a new build; setting it on a running container does nothing for the browser code.
  Server-only variables (`MAINNET_RPC_URL`, `PINATA_JWT`, `COMMENT_STORE_*`, webhook URLs,
  `METRICS_SECRET_TOKEN`) are read at runtime.
- The build emits `.next/standalone` (a self-contained `server.js`), `.next/static` and uses `public/`.

## Release flow

Versioning uses [Changesets](https://github.com/changesets/changesets).

1. **In every PR** that changes behaviour, add a changeset: `npm run changeset` (choose the bump,
   write a user-facing summary). `changeset-check.yml` validates it with `npm run changeset:check`.
2. **Merge to `main`.** `release.yml` runs on every push to `main` and uses `changesets/action` to
   open or update a **"chore: version bump"** pull request that bumps `package.json` and updates the
   changelog from the pending changesets.
3. **Merge the version-bump PR.** The next `release.yml` run publishes (`npm run release` →
   `changeset publish`), and when something was published the `docker-release` job builds the
   image and pushes it to GHCR as:
   - `ghcr.io/<owner>/<repo>:latest`
   - `ghcr.io/<owner>/<repo>:<package.json version>`
4. **Deploy** the new version to your target (below). The Vercel integration, if connected, deploys
   `main` on its own; the Docker image must be pulled and rolled out by whoever runs it.

CI (`ci.yml`) runs lint, typecheck, tests with coverage, the production build and a Lighthouse
check on pushes to `main` and on pull requests; see [CI_WORKFLOWS.md](./CI_WORKFLOWS.md) and
[CI-PIPELINE.md](./CI-PIPELINE.md). Never release from a red `main`.

## Vercel

### One-time setup

1. Import the repository in Vercel; framework preset **Next.js**, Node.js version **22.x**.
2. Leave the default install (`npm ci`) and build (`npm run build`) commands. The repo has both
   `package-lock.json` and `pnpm-lock.yaml`; the project standard is **npm**, so make sure the
   Vercel project uses npm.
3. Add environment variables per environment (Settings → Environment Variables):

   | Variable                                                                    | Preview                                       | Production                                                 |
   | --------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
   | `NEXT_PUBLIC_USE_MOCKS`                                                     | `false`                                       | `false`                                                    |
   | `NEXT_PUBLIC_STELLAR_NETWORK` / `NEXT_PUBLIC_NETWORK_PASSPHRASE`            | testnet (`Test SDF Network ; September 2015`) | mainnet (`Public Global Stellar Network ; September 2015`) |
   | `NEXT_PUBLIC_SOROBAN_RPC_URL`                                               | `https://soroban-testnet.stellar.org`         | your mainnet RPC (public value)                            |
   | `NEXT_PUBLIC_CONTRACT_ADDRESS`                                              | testnet contract                              | mainnet contract                                           |
   | `NEXT_PUBLIC_SITE_URL`                                                      | the preview URL (optional)                    | `https://proofofheart.xyz`                                 |
   | `MAINNET_RPC_URL`, `PINATA_JWT`, `COMMENT_STORE_REDIS_REST_*`, webhook URLs | as needed (secrets)                           | as needed (secrets)                                        |

   Mark secrets as sensitive and never prefix them with `NEXT_PUBLIC_`.

4. Optional: set the production domain, then verify `https://<domain>/api/health` returns `healthy`.

### Deploying

- **Preview:** every pull request gets a preview deployment from the Vercel Git integration. Check
  it against testnet before approving.
- **Production:** merging to `main` (after the version-bump PR for a release) deploys production.
  To redeploy without a code change, use _Redeploy_ in the dashboard — remember `NEXT_PUBLIC_*`
  changes need a **fresh build**, not a cached one (untick "Use existing build cache" if in doubt).
- **CLI alternative:** `npx vercel deploy --prebuilt` / `npx vercel deploy --prod` with
  `VERCEL_TOKEN` configured, passing build-time values with `--build-env KEY=value`
  (see [PREVIEW_DEPLOYMENTS.md](./PREVIEW_DEPLOYMENTS.md)).

## Docker image

`Dockerfile` is a three-stage build on a digest-pinned `node:22-alpine`:

| Stage     | Does                                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `deps`    | Copies `package.json` + `package-lock.json` only and runs `npm ci` (maximum layer reuse; `pnpm-lock.yaml` is deliberately not copied). |
| `builder` | Copies `node_modules`, config files, `messages`, `public` and `src`, then `npm run build` (including the mock-mode check).             |
| `runner`  | Minimal image: `.next/standalone`, `.next/static` and `public`, running as non-root user `nextjs` (uid 1001) on port 3000.             |

The runner exposes port `3000`, listens on `0.0.0.0`, and defines a `HEALTHCHECK` that requests
`/api/health` every 30 s (10 s timeout, 30 s start period, unhealthy after 3 failures). The endpoint
returns HTTP 200 only when the app **and** the Soroban RPC are healthy and 503 (`degraded`) when the
RPC check fails, so an RPC outage also marks the container unhealthy.

### Build

```bash
docker build -t proofofheart-frontend:local .
```

**`NEXT_PUBLIC_*` values for the image.** The Dockerfile does not currently declare `ARG`/`ENV`
for them, so `--build-arg NEXT_PUBLIC_…` has no effect and the client bundle is built with the
defaults. For a real deployment add, in the `builder` stage before `RUN npm run build`:

```dockerfile
ARG NEXT_PUBLIC_USE_MOCKS=false
ARG NEXT_PUBLIC_STELLAR_NETWORK
ARG NEXT_PUBLIC_NETWORK_PASSPHRASE
ARG NEXT_PUBLIC_SOROBAN_RPC_URL
ARG NEXT_PUBLIC_CONTRACT_ADDRESS
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_USE_MOCKS=$NEXT_PUBLIC_USE_MOCKS \
    NEXT_PUBLIC_STELLAR_NETWORK=$NEXT_PUBLIC_STELLAR_NETWORK \
    NEXT_PUBLIC_NETWORK_PASSPHRASE=$NEXT_PUBLIC_NETWORK_PASSPHRASE \
    NEXT_PUBLIC_SOROBAN_RPC_URL=$NEXT_PUBLIC_SOROBAN_RPC_URL \
    NEXT_PUBLIC_CONTRACT_ADDRESS=$NEXT_PUBLIC_CONTRACT_ADDRESS \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
```

then build with `docker build --build-arg NEXT_PUBLIC_CONTRACT_ADDRESS=C… …`. Use a separate image
(tag) per network, since these values cannot be changed at run time.

### Run

```bash
docker run -d --name poh -p 3000:3000 \
  -e MAINNET_RPC_URL=... -e PINATA_JWT=... \
  proofofheart-frontend:local

curl -s http://localhost:3000/api/health     # {"status":"healthy",...}
docker inspect --format '{{.State.Health.Status}}' poh
```

Pass **server-only** variables with `-e` / an env file / your orchestrator's secrets. For more than
one instance set `COMMENT_STORE_DRIVER=redis` with `COMMENT_STORE_REDIS_REST_URL` and
`COMMENT_STORE_REDIS_REST_TOKEN`; the default file/memory stores are per instance.

### Published images

On a release, `release.yml` pushes `:latest` and `:<version>` to `ghcr.io/<owner>/<repo>`.
Deploy a **version tag**, not `:latest`, so a rollback is a one-line change:

```bash
docker pull ghcr.io/<owner>/<repo>:0.1.0
```

## Docker Compose

`docker-compose.yml` defines one service, `app`, for **local development**:

```yaml
services:
  app:
    build: { context: ., dockerfile: Dockerfile }
    ports: ["3000:3000"]
    environment: [NODE_ENV=development]
    volumes: [".:/app", "/app/node_modules", "/app/.next"]
    command: npm run dev
```

```bash
docker compose up --build        # start on http://localhost:3000
docker compose down              # stop
```

It bind-mounts the working tree for hot reload and overrides the container command with
`npm run dev`, so it does **not** run the production server or exercise the standalone output. It is
not a production deployment file; to run the production image locally use `docker run` as above.
Put local configuration in `.env.local` (copy from `.env.example`; mock mode is on by default there).

## Pre-release checklist

- [ ] `main` is green (lint, typecheck, tests, build).
- [ ] The pending changesets describe the release; the version-bump PR looks right.
- [ ] `NEXT_PUBLIC_USE_MOCKS` is `false` and the network passphrase, RPC and contract address match
      the target network.
- [ ] Secrets are set in the target environment (not committed).
- [ ] Staging/preview was verified on testnet: wallet connect, a contribution, explorer links.
- [ ] After deploy: `/api/health` is healthy, the explorer links point to the right network, and the
      browser console shows no Content Security Policy violations.

## Rollback

- **Vercel:** Deployments → pick the last good production deployment → _Promote to Production_ /
  _Instant Rollback_. No rebuild is needed.
- **Docker:** redeploy the previous version tag (`…:<previous-version>`); because the image tag
  encodes the version, no rebuild is needed.
- **Code:** revert the offending commit on `main` and let the pipeline publish a patch release.
  Do not force-push `main` or delete published tags.
- A bad contract address or network setting is an **environment** problem: fix the variable and
  redeploy with a fresh build rather than reverting code.

## Known gaps

- `scripts/validate-production-build.mjs` only blocks mock mode; it does not validate the passphrase
  or contract address, although [DEPLOYMENT_ENVIRONMENTS.md](./DEPLOYMENT_ENVIRONMENTS.md) says it does.
- `release.yml` passes `NEXT_PUBLIC_USE_MOCKS=false` as a Docker `build-arg`, but the Dockerfile has no
  matching `ARG`, so the published image is built with the Dockerfile's defaults.
- [PREVIEW_DEPLOYMENTS.md](./PREVIEW_DEPLOYMENTS.md) refers to `.github/workflows/preview-deploy.yml`,
  which is not in the repository; previews rely on the Vercel Git integration.
- There is no `.dockerignore`, so the whole working tree (including `node_modules` and `.next`) is
  sent as build context even though the Dockerfile copies only selected paths.
- `CI_WORKFLOWS.md` describes `ci.yml` more minimally than the current workflow; check the workflow
  file when in doubt.

## Troubleshooting

| Symptom                                                                 | Cause                                          | Fix                                                                                       |
| ----------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Build fails with "Production build blocked: NEXT_PUBLIC_USE_MOCKS=true" | Mock mode is on                                | Set it to `false` (or `SKIP_MOCK_CHECK=true` for a test build)                            |
| Deployed site shows testnet/mock data                                   | `NEXT_PUBLIC_*` not set at **build** time      | Set variables, rebuild/redeploy without cache                                             |
| Container restarts / `unhealthy`                                        | `/api/health` failing (RPC unreachable)        | `docker logs`, check `NEXT_PUBLIC_SOROBAN_RPC_URL` and egress                             |
| Wallet or RPC calls blocked in the browser                              | Origin missing from the CSP `connect-src`      | See [PRE_COMMIT_SETUP.md](../PRE_COMMIT_SETUP.md#content-security-policy-csp-maintenance) |
| Comments disappear after a deploy                                       | File/memory comment store on an ephemeral disk | Use `COMMENT_STORE_DRIVER=redis`                                                          |
| More diagnostics                                                        |                                                | [troubleshooting.md](./troubleshooting.md)                                                |
