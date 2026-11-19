# `src/lib/generated/` — contract bindings (issue #1790)

Generated TypeScript bindings for the ProofOfHeart Soroban contract
([Iris-IV/ProofOfHeart-stellar](https://github.com/Iris-IV/ProofOfHeart-stellar)).
**Do not edit these files by hand** — regenerate them instead.

| File                  | What it is                                                                 |
| --------------------- | -------------------------------------------------------------------------- |
| `contract-spec.json`  | Normalized interface spec: every consumed entrypoint with arg/return types and the `#[contracttype]` struct shapes. |
| `client.ts`           | Typed read client (`ProofOfHeartGeneratedClient`): owns method names, ScVal argument encoding and struct decoding. |

## Why

`contractClient.ts` used to hand-write every `nativeToScVal` call and XDR
decode. A contract-side signature or struct change then needs a matching
manual edit on the frontend — the source of the shape bugs fixed in
#1666–#1669. Generating the read surface from the contract's own spec makes
the mapping mechanical and reviewable.

## Regenerating

```bash
npm run bindings:generate
```

`scripts/generate-contract-bindings.mjs` resolves the contract interface from,
in order of preference:

1. `--spec <path>` — a `stellar contract info interface --output json` dump
   you already have;
2. `--wasm <path>` — a local `proof_of_heart.wasm`; runs
   `stellar contract info interface --wasm <path> --output json`
   (requires the [Stellar CLI](https://developers.stellar.org/docs/tools/cli));
3. the `contract-spec.json` artifact published by the contract repo's CI
   (Iris-IV/ProofOfHeart-stellar#1473) — downloaded with `gh`.

The committed baseline in this directory is the **read surface** consumed by
`contractClient.ts` (all 24 view methods it calls). Writes migrate
incrementally per #1790; the contract's full entrypoint list (139 at the time
of writing) is documented in the contract repo's
[`docs/API.md`](https://github.com/Iris-IV/ProofOfHeart-stellar/blob/main/docs/API.md).

## Consuming

```ts
import { createGeneratedClient } from "./generated/client";

const generated = createGeneratedClient(invokeViewMethod);
const stats = await generated.getPlatformStats(); // typed, decoded
```

The client is transport-agnostic: `contractClient.ts` injects its cached,
latency-budgeted `invokeViewMethod` so caching, RPC failover and observability
keep working unchanged.
