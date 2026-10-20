# Gas & Network Fee Estimation — Technical Specification

How ProofOfHeart estimates, displays and caps Stellar/Soroban network fees. Three modules cooperate:

| Module                                                       | Responsibility                                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `src/lib/contractClient.ts` → `estimateContributeNetworkFee` | The **exact** fee for a contribution, from a Soroban simulation. Used by the donation modal.        |
| `src/lib/networkFee.ts`                                      | Static fallback fee, env override, display helpers, Soroban resource-limit padding.                 |
| `src/lib/feeEstimation.ts`                                   | **Congestion-aware range and fee cap**: typical → worst-case estimate plus an inclusion-fee buffer. |

All amounts are **stroops** (`bigint`) unless a name says `Xlm`. `1 XLM = 10 000 000 stroops`
(`STROOPS_PER_XLM` in `src/lib/stellarAmount.ts`). Never store fees as floating-point numbers.

- [Fee model](#fee-model)
- [1. Simulation-based estimate](#1-simulation-based-estimate)
- [2. Fallback estimate](#2-fallback-estimate)
- [3. Congestion range and fee cap](#3-congestion-range-and-fee-cap-srclibfeeestimationts)
- [4. Resource limits](#4-resource-limits)
- [Worked example](#worked-example)
- [Edge cases and invariants](#edge-cases-and-invariants)
- [Configuration](#configuration)
- [Testing](#testing)
- [Current integration status](#current-integration-status)

## Fee model

A Soroban transaction fee is the sum of an **inclusion fee** (a bid for ledger space, floor = the
base fee, `BASE_FEE` = 100 stroops per operation) and a **resource fee** (CPU instructions, memory,
ledger reads/writes and transaction size). The resource fee is deterministic for a given
transaction and is what simulation returns; the inclusion fee is market-driven and rises when
ledgers are full. A transaction whose inclusion fee is too low during a surge is not included and
must be rebuilt, so the UI estimates the likely fee and the builder needs a ceiling with headroom.

## 1. Simulation-based estimate

`estimateContributeNetworkFee(campaignId, contributor, amount)` (`src/lib/contractClient.ts`):

1. Validates the contributor address and amount.
2. In mock mode (`NEXT_PUBLIC_USE_MOCKS=true`) returns `100_000n` without any RPC call.
3. Builds the real `contribute` invocation from a **copy** of the cached account
   (`new Account(id, sequence)`), so estimating never consumes a sequence number needed for submission.
4. Calls `simulateTransaction` through `withRpcServer` (primary RPC with fallback).
5. A simulation error is normalised by `normalizeContractError`, so the caller gets the same typed
   contract errors as a real submission (for example `ContractPaused`).
6. Otherwise runs `rpc.assembleTransaction(...)` and returns `BigInt(prepared.fee)`: the base fee
   plus the simulated resource fee.

`DonationModal` calls this 300 ms after the amount changes (debounced; a stale response is
discarded), converts it with `stroopsToXlmNumber`, and shows it as the network-fee line.

## 2. Fallback estimate

`src/lib/networkFee.ts` provides the value shown when simulation is unavailable (RPC outage,
no wallet yet):

- `DEFAULT_CONTRIBUTE_NETWORK_FEE_STROOPS = 100_000n` (0.01 XLM), deliberately conservative.
- `NEXT_PUBLIC_ESTIMATED_CONTRIBUTE_NETWORK_FEE_STROOPS` overrides it. The value must parse as a
  positive integer; anything else (blank, `0`, negative, non-numeric) is ignored and the default is used.
- `getEstimatedContributeNetworkFeeStroops()`, `getEstimatedContributeNetworkFeeXlm()` and
  `formatEstimatedNetworkFeeXlm(maximumFractionDigits = 7)` expose it in stroops, XLM and as a string.

The submission path always simulates again, so a stale display estimate can never produce an
under-funded transaction.

## 3. Congestion range and fee cap (`src/lib/feeEstimation.ts`)

### `estimateFeeRange(baseFeeStroops, recentMaxFeeChargedStroops): FeeEstimateRange`

Inputs: the base estimate and the highest inclusion fee recently charged (for example Soroban RPC's
`getFeeStats().sorobanInclusionFee.max`).

```
ratio        = recentMax / base          (0 when base <= 0)
isCongested  = ratio >= 3                CONGESTION_RATIO_THRESHOLD
multiplier   = isCongested ? 10 : 1      CONGESTED_SURGE_MULTIPLIER / MIN_SURGE_MULTIPLIER
typical      = base
worstCase    = base * multiplier
```

Returns `{ typicalStroops, worstCaseStroops, surgeMultiplier, isCongested }`.

### Buffer

The worst case still needs headroom for a surge between building and ledger close. The buffer is a
percentage of the worst case in **basis points** (10 000 bps = 100 %):

| Constant                            | Value        | Applies when  |
| ----------------------------------- | ------------ | ------------- |
| `DEFAULT_FEE_BUFFER_BPS`            | 1 000 (10 %) | network idle  |
| `DEFAULT_CONGESTION_FEE_BUFFER_BPS` | 5 000 (50 %) | `isCongested` |

- `effectiveFeeBufferBps(range, options?)` picks the percentage. While congested it uses
  `max(bufferBps, congestionBufferBps)`, so a custom idle buffer can never _reduce_ congestion
  headroom.
- `calculateInclusionFeeBuffer(range, options?)` = `worstCase * bps / 10_000` (integer division,
  rounds down).
- `recommendedFeeCapStroops(range, options?)` = `worstCase + buffer`. This is the "max fee" a UI
  should present and the ceiling a builder should use.

`GasBufferOptions` (`bufferBps`, `congestionBufferBps`) are sanitised by `clampBps`: negative,
`NaN` or infinite values fall back to the default, and fractions are truncated.

## 4. Resource limits

`computeResourceLimits(footprint, options?)` (`src/lib/networkFee.ts`) turns a simulation footprint
into the limits to request, multiplying each dimension by `RESOURCE_LIMIT_HEADROOM_MULTIPLIER`
(1.1, rounded up). A missing, non-finite or non-positive dimension uses
`DEFAULT_SOROBAN_RESOURCE_LIMITS` (2 000 000 instructions, 20 000 read bytes, 10 000 write bytes),
or `options.fallback`.

## Worked example

Base fee 100 000 stroops (0.01 XLM).

| Scenario                 | recent max | ratio | congested | typical | worst case | buffer         | recommended cap          |
| ------------------------ | ---------- | ----- | --------- | ------- | ---------- | -------------- | ------------------------ |
| Idle                     | 100 000    | 1     | no        | 100 000 | 100 000    | 10 % = 10 000  | **110 000**              |
| Busy but below threshold | 250 000    | 2.5   | no        | 100 000 | 100 000    | 10 000         | **110 000**              |
| Surge                    | 400 000    | 4     | yes       | 100 000 | 1 000 000  | 50 % = 500 000 | **1 500 000** (0.15 XLM) |

```ts
import { estimateFeeRange, recommendedFeeCapStroops } from "@/lib/feeEstimation";

const range = estimateFeeRange(100_000n, 400_000n);
// { typicalStroops: 100000n, worstCaseStroops: 1000000n, surgeMultiplier: 10, isCongested: true }

recommendedFeeCapStroops(range); // 1_500_000n
recommendedFeeCapStroops(range, { congestionBufferBps: 2_000 }); // 1_200_000n
```

## Edge cases and invariants

- `base <= 0` → ratio 0 → never congested (no division by zero); worst case equals the base.
- The ratio is computed with `Number(...)`; fee values far above `2^53` lose precision in the
  _ratio only_ — the stroop amounts themselves stay exact `bigint`.
- `typicalStroops <= worstCaseStroops <= recommendedFeeCap` always holds.
- Buffer rounding is down; for tiny worst-case values the buffer can be `0`.
- Estimation never mutates shared state (see the account copy in §1).
- Display rounding is the caller's job; keep arithmetic in stroops and convert last.

## Configuration

| Variable                                                               | Effect                                                         | Default            |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------ |
| `NEXT_PUBLIC_ESTIMATED_CONTRIBUTE_NETWORK_FEE_STROOPS`                 | Fallback fee when simulation is unavailable (positive integer) | `100000`           |
| `NEXT_PUBLIC_USE_MOCKS`                                                | Mock mode returns a fixed `100000` stroops                     | `false`            |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` / `NEXT_PUBLIC_SOROBAN_RPC_FALLBACK_URL` | RPC used for simulation                                        | testnet public RPC |

The congestion thresholds and multipliers are constants in `src/lib/feeEstimation.ts`, not
environment-configurable; change them in code with a test update.

## Testing

- `src/lib/feeEstimation.test.ts` — range, congestion threshold, zero base fee, buffers and caps.
- `src/__tests__/lib/networkFee.test.ts` — fallback, env override parsing and resource limits.
- When changing a constant, add a case at both sides of the boundary (ratio 2.99 / 3, buffer 0 and
  non-zero).

## Current integration status

The donation modal uses the simulation-based estimate (§1) with the static fallback (§2).
`estimateFeeRange` / `recommendedFeeCapStroops` (§3) are implemented and tested but are **not yet
called from any component**; wiring them in means fetching `getFeeStats()` from the RPC, building the
range, showing `typical – worstCase` in the UI and passing `recommendedFeeCapStroops` as the
transaction fee ceiling.

## Related

- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md), [STELLAR_AMOUNT.md](./STELLAR_AMOUNT.md),
  [CONTRACT_INTEGRATION.md](./CONTRACT_INTEGRATION.md), [troubleshooting.md](./troubleshooting.md)
