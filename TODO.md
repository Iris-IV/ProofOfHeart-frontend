# Fix Issues - TODO

## Issue 1: Admin Transfer Confirmation Modal
- [ ] Create `src/components/TransferAdminModal.tsx`
- [ ] Update `src/app/[locale]/admin/page.tsx` to use modal
- [ ] Add translations to `messages/en.json` and `messages/es.json`

## Issue 2: Contract Error Translations
- [ ] Update `src/utils/contractErrors.ts` to return translation keys
- [ ] Add `ContractErrors` namespace to `messages/en.json`
- [ ] Add `ContractErrors` namespace to `messages/es.json`
- [ ] Update `src/lib/contractClient.ts` to use error codes instead of message sniffing
- [ ] Update all `parseContractError` callers to use `useTranslations('ContractErrors')`

## Issue 3: Navbar ARIA
- [ ] Add `aria-pressed` to theme toggle in `src/components/Navbar.tsx`

## Follow-up
- [ ] Run lint
- [ ] Run tests
- [ ] Verify translations JSON validity

