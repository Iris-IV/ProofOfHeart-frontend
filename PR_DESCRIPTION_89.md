## Summary
- #89: Remove deprecated mock src/services/stellarVoting.ts

## Changes
- Deleted `src/services/stellarVoting.ts`, which is marked deprecated and has been replaced by real Soroban contract calls in `src/lib/contractClient.ts`.
- Removed the now-empty `src/services/` directory to complete the cleanup and avoid retaining dead structure.
- Verified there are no remaining references/imports to `stellarVoting` service symbols in `src/`.

## Testing
- [x] Searched for references to `services/stellarVoting`, `stellarVotingService`, and `StellarVotingService` in `src/` and confirmed no matches.
- [x] Ran `npm test` (all suites passing: 7/7, 93 tests).
- [ ] `npm run build` currently fails due to a pre-existing unrelated type error in `src/hooks/useCampaign.ts` (`getCampaign` returns `Campaign | null` while `useQuery<Campaign>` expects `Campaign`).
- [x] Edge case: validated that removing the file/directory introduces no broken imports tied to the deleted service.

## Closing
Closes Iris-IV/ProofOfHeart-frontend#89
