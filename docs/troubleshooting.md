# Error Codes & Troubleshooting Knowledge Base

A reference for the errors the frontend can show, what causes them, and how to fix them.
Use it together with [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) (configuration) and
[DEPLOYMENT_ENVIRONMENTS.md](./DEPLOYMENT_ENVIRONMENTS.md).

- [How errors reach the UI](#how-errors-reach-the-ui)
- [Contract error codes](#contract-error-codes)
- [Wallet errors](#wallet-errors)
- [Network and RPC errors](#network-and-rpc-errors)
- [Configuration errors](#configuration-errors)
- [Off-chain API errors](#off-chain-api-errors)
- [Quick diagnostics checklist](#quick-diagnostics-checklist)

## How errors reach the UI

1. A contract call goes through `src/lib/contractClient.ts`. Simulation failures and reverts are
   normalised by `normalizeContractError`; wallet rejections are converted by
   `wrapFreighterError` (`src/utils/freighterErrors.ts`).
2. `getContractErrorCode` (`src/utils/contractErrors.ts`) extracts the numeric code from the
   Soroban formats `Error(Contract, #N)` and `contractError: N`.
3. `parseContractError(error)` returns a translation key such as `ContractErrors.AlreadyVoted`.
   If the error has no known code but carries a short human-readable message (under 200 characters,
   no stack frames) that message is returned as-is; anything else becomes
   `ContractErrors.UnexpectedError`.
4. The component resolves the key through `useTranslations("ContractErrors")`. The English strings
   live in `messages/en.json` under `ContractErrors`.

```ts
import { parseContractError } from "@/utils/contractErrors";

try {
  await contribute(campaignId, amount);
} catch (err) {
  showError(tContractErrors(parseContractError(err).replace("ContractErrors.", "")));
}
```

Contract reverts are deterministic: retrying the same call with the same state fails again
(`isContractErrorMessage` is used to skip retries for them).

## Contract error codes

Codes mirror the on-chain `ContractError` enum (`src/utils/contractErrors.ts`). Codes 42, 43, 46 and
48 are not defined in the frontend enum, so they fall back to the generic message.

| Code | Name                         | User-facing message                                         |
| ---- | ---------------------------- | ----------------------------------------------------------- |
| 1    | `NotAuthorized`              | You are not authorized to perform this action.              |
| 2    | `CampaignNotFound`           | This campaign could not be found.                           |
| 3    | `CampaignNotActive`          | This campaign is no longer accepting contributions.         |
| 4    | `FundingGoalMustBePositive`  | The funding goal must be greater than zero.                 |
| 5    | `InvalidDuration`            | The campaign duration is invalid.                           |
| 6    | `InvalidRevenueShare`        | The revenue share percentage is invalid.                    |
| 7    | `RevenueShareOnlyForStartup` | Revenue sharing is only available for startup campaigns.    |
| 8    | `DeadlinePassed`             | The campaign deadline has passed.                           |
| 9    | `ContributionMustBePositive` | Please enter a valid contribution amount.                   |
| 10   | `DeadlineNotPassed`          | The campaign deadline has not passed yet.                   |
| 11   | `FundsAlreadyWithdrawn`      | The funds for this campaign have already been withdrawn.    |
| 12   | `FundingGoalNotReached`      | The funding goal has not been reached yet.                  |
| 13   | `NoFundsToWithdraw`          | There are no funds available to withdraw.                   |
| 14   | `CampaignAlreadyVerified`    | This campaign has already been verified.                    |
| 15   | `ValidationFailed`           | Validation failed. Please check your input and try again.   |
| 16   | `AlreadyVoted`               | You have already voted on this campaign.                    |
| 17   | `NotTokenHolder`             | You must hold the platform token to vote.                   |
| 18   | `VotingQuorumNotMet`         | Not enough votes have been cast yet.                        |
| 19   | `VotingThresholdNotMet`      | The approval threshold has not been reached.                |
| 20   | `AlreadyClaimed`             | This reward has already been claimed.                       |
| 21   | `InvalidMilestone`           | Invalid milestone.                                          |
| 22   | `MilestoneNotFound`          | Milestone not found.                                        |
| 23   | `MilestoneAlreadyApproved`   | Milestone already approved.                                 |
| 24   | `ContractPaused`             | Contract is paused.                                         |
| 25   | `ContributionCapExceeded`    | Contribution cap exceeded.                                  |
| 26   | `CampaignNotVerified`        | Campaign not verified.                                      |
| 27   | `InvalidAmount`              | Invalid amount.                                             |
| 28   | `TransferFailed`             | Transfer failed.                                            |
| 29   | `InsufficientBalance`        | Insufficient balance.                                       |
| 30   | `Overflow`                   | Arithmetic overflow.                                        |
| 31   | `Underflow`                  | Arithmetic underflow.                                       |
| 32   | `CreationDisabled`           | Campaign creation is disabled.                              |
| 33   | `InvalidFee`                 | Invalid fee.                                                |
| 34   | `AlreadyInitialized`         | Already initialized.                                        |
| 35   | `NotInitialized`             | Not initialized.                                            |
| 36   | `InvalidAddress`             | Invalid address.                                            |
| 37   | `Expired`                    | Expired.                                                    |
| 38   | `InvalidSignature`           | Invalid signature.                                          |
| 39   | `UnauthorizedAdmin`          | Unauthorized admin.                                         |
| 40   | `InvalidVestingSchedule`     | Invalid vesting schedule.                                   |
| 41   | `InvalidVestingDelay`        | Invalid vesting delay.                                      |
| 44   | `CampaignAlreadyBookmarked`  | This campaign is already in your saved list.                |
| 45   | `CampaignNotBookmarked`      | This campaign is not in your saved list.                    |
| 47   | `BookmarkLimitReached`       | Your saved list is full. Remove a campaign to save another. |
| 49   | `MilestoneNotVerified`       | Milestone has not been verified yet.                        |
| 50   | `MilestoneAlreadyClaimed`    | Milestone payout has already been claimed.                  |

### Resolving common contract errors

| Error                                              | Likely cause                                                                                                   | What to do                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `NotAuthorized` (1) / `UnauthorizedAdmin` (39)     | The connected wallet is not the campaign creator or the platform admin.                                        | Switch to the correct account in the wallet, then reconnect.            |
| `CampaignNotFound` (2)                             | Wrong campaign id, or the app points at a different contract/network than the one the campaign was created on. | Check `NEXT_PUBLIC_CONTRACT_ADDRESS` and `NEXT_PUBLIC_STELLAR_NETWORK`. |
| `DeadlinePassed` (8) / `CampaignNotActive` (3)     | The campaign ended or was cancelled.                                                                           | Nothing to fix; contributions are closed.                               |
| `NotTokenHolder` (17)                              | Voting requires the platform token.                                                                            | Acquire the token on the same network, then vote again.                 |
| `ContractPaused` (24) / `CreationDisabled` (32)    | An admin paused the contract or disabled creation.                                                             | Wait for the admin to unpause; nothing to fix client-side.              |
| `InsufficientBalance` (29) / `TransferFailed` (28) | Not enough of the contribution token, or no trustline.                                                         | Fund the wallet and confirm the token trustline exists.                 |
| `InvalidSignature` (38) / `Expired` (37)           | A signed payload was altered or is too old.                                                                    | Retry; sign again with the same wallet.                                 |

## Wallet errors

| Symptom / error                                                                                               | Source                         | Cause                                                                                                                                                             | Fix                                                                      |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `UserCancelledError` — "Transaction cancelled"                                                                | `src/utils/freighterErrors.ts` | The user rejected the signing prompt. Matched by messages containing "user declined", "user rejected", "user cancelled", "request cancelled" or "denied by user". | Not a failure; the user can retry.                                       |
| `FreighterLockedError` — "Freighter is locked"                                                                | `src/utils/freighterErrors.ts` | The extension reported it is locked (messages such as "wallet is locked", "unlock your wallet").                                                                  | Unlock Freighter and retry.                                              |
| `ActionTimeoutError` — "This request is taking longer than expected. Please check your wallet and try again." | `src/utils/asyncAction.ts`     | A wallet or transaction action did not finish within `ACTION_TIMEOUT_MS` (45 s). A signing prompt may be hidden behind another window.                            | Open the wallet extension, resolve or dismiss the pending prompt, retry. |
| Connect button does nothing / no wallet detected                                                              | Freighter                      | Extension not installed, disabled for the site, or the page is in a private window where extensions are off.                                                      | Install/enable Freighter and allow the site; reload.                     |
| Wallet is on the wrong network                                                                                | Freighter                      | Freighter network differs from `NEXT_PUBLIC_STELLAR_NETWORK` / `NEXT_PUBLIC_NETWORK_PASSPHRASE`.                                                                  | Switch the network in Freighter to match.                                |
| Social login buttons missing                                                                                  | Web3Auth                       | `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` is unset.                                                                                                                        | Set it, or use Freighter. See [SOCIAL_LOGIN.md](./SOCIAL_LOGIN.md).      |

## Network and RPC errors

| Symptom                                                                  | Cause                                                                                                                                                                                                      | Fix                                                                                        |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| "Soroban RPC did not respond within Nms" (`RpcLatencyExceededError`)     | The primary RPC was slower than `NEXT_PUBLIC_RPC_LATENCY_THRESHOLD_MS` (default 3000). If `NEXT_PUBLIC_SOROBAN_RPC_FALLBACK_URL` is set, the call is retried there and the fallback stays active for 60 s. | Set a fallback RPC, raise the threshold, or switch the primary RPC.                        |
| Pages load but campaigns never appear                                    | RPC unreachable or wrong URL. `GET /api/health` reports `services.rpc` as `healthy` or `unhealthy`.                                                                                                        | `curl http://localhost:3000/api/health`; verify `NEXT_PUBLIC_SOROBAN_RPC_URL`.             |
| Mainnet calls fail with 401/403                                          | Mainnet RPC requires an API key and the browser is using the public URL.                                                                                                                                   | Set the server-side `MAINNET_RPC_URL` (never `NEXT_PUBLIC_`).                              |
| "Transaction simulation failed."                                         | The simulation reverted without a recognised contract code.                                                                                                                                                | Read the underlying message in the console; check the contract address and network.        |
| Browser console: "Refused to connect … violates Content Security Policy" | A new RPC/API origin is not in `connect-src`.                                                                                                                                                              | See [PRE_COMMIT_SETUP.md](../PRE_COMMIT_SETUP.md#content-security-policy-csp-maintenance). |

## Configuration errors

| Symptom                                                                                                                          | Cause                                                                                                               | Fix                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `EnvValidationError: Invalid environment configuration` at startup, followed by a list of `ERROR` / `WARNING` lines per variable | A variable has the wrong shape, a secret is exposed through a `NEXT_PUBLIC_` name, or a cross-variable rule failed. | Fix the listed variables; the full contract is in `src/lib/envContract.ts` and [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md). |
| An env var change has no effect on a `NEXT_PUBLIC_*` value                                                                       | `NEXT_PUBLIC_*` values are inlined at build time.                                                                   | Rebuild (`npm run build`) after changing them; restart `npm run dev`.                                                                  |
| Mock data shows instead of real campaigns                                                                                        | `NEXT_PUBLIC_USE_MOCKS=true`.                                                                                       | Set it to `false` or remove it.                                                                                                        |
| Maintenance page for everyone                                                                                                    | `NEXT_PUBLIC_MAINTENANCE_MODE=true`.                                                                                | Unset it, or add admin wallets to `NEXT_PUBLIC_MAINTENANCE_ALLOWLIST`.                                                                 |
| Image upload fails                                                                                                               | `PINATA_JWT` is missing or invalid.                                                                                 | Set a valid Pinata JWT (server-side).                                                                                                  |

## Off-chain API errors

`OffchainApiError` (`src/lib/offchainApiClient.ts`) carries an HTTP `status` and optional `details`.
Requests time out after 15 s and are retried twice by default.

| Status        | Meaning                                                                                                                               | Fix                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 400           | Payload failed validation.                                                                                                            | Inspect `details` for the field.                                                        |
| 401 / 403     | The request was rejected as unauthenticated or not permitted (for example a wallet signature was missing or from a different wallet). | Reconnect the wallet and retry.                                                         |
| 429           | Rate limit hit (comments, reports).                                                                                                   | Wait and retry.                                                                         |
| 5xx / timeout | Store or upstream unavailable.                                                                                                        | Check `COMMENT_STORE_DRIVER` and, for Redis, `COMMENT_STORE_REDIS_REST_URL` / `_TOKEN`. |

## Quick diagnostics checklist

1. Open the browser console and look for the first red error; contract errors contain `Error(Contract, #N)`.
2. Look the code up in [Contract error codes](#contract-error-codes).
3. Confirm network alignment: Freighter network, `NEXT_PUBLIC_STELLAR_NETWORK`,
   `NEXT_PUBLIC_NETWORK_PASSPHRASE` and the contract address must all refer to the same network.
4. `curl /api/health` to check the app and RPC reachability.
5. Re-run with mocks (`NEXT_PUBLIC_USE_MOCKS=true npm run dev`) to separate UI problems from chain/RPC problems.
6. If a problem persists, open an issue with the console error, the network, the wallet and the steps to reproduce.
