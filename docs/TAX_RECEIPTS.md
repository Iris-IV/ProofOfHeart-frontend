# Tax Receipt Generation & Legal Compliance

How donation tax receipts are produced, what they contain, what they do **not** guarantee, and what
must be reviewed before they are presented to donors as tax documentation.

> This document describes the software. It is **not legal or tax advice**. Whether a receipt is
> valid for a deduction depends on the donor's jurisdiction and on the legal status of the issuer
> and the recipient. Have counsel confirm the points in [Compliance checklist](#compliance-checklist)
> before launch.

- [Overview](#overview)
- [Data flow](#data-flow)
- [Receipt contents](#receipt-contents)
- [API](#api)
- [Configuration](#configuration)
- [Behaviour and limits](#behaviour-and-limits)
- [Security considerations](#security-considerations)
- [Compliance checklist](#compliance-checklist)
- [Extending the receipt](#extending-the-receipt)
- [Testing](#testing)

## Overview

After a successful contribution, the donation dialog offers **Download receipt**. Clicking it calls
`downloadTaxReceipt()` (`src/lib/taxReceipt.ts`), which builds a self-contained HTML page in the
browser, opens it in a new window and triggers the browser's print dialog so the donor can print it
or "Save as PDF". There is **no server involvement and no receipt is stored**: nothing is persisted,
numbered or emailed, and the platform cannot re-issue a receipt later (the donor can only generate
one again from the same dialog session).

## Data flow

```
DonationModal (success state, txHash present)
  └─ downloadTaxReceipt({ transactionHash, campaignTitle, amountXlm, donorAddress, donationDate })
       ├─ builds HTML string (inline CSS, no external requests)
       ├─ Blob(text/html) → URL.createObjectURL
       ├─ window.open(url, "_blank", "width=700,height=800")
       │    ├─ opened: onload → revoke the object URL after 1 s; page runs window.print()
       │    └─ blocked by the browser: revoke the object URL immediately (no receipt is shown)
       └─ returns void
```

`src/components/DonationModal.tsx` supplies the values: the on-chain transaction hash, the campaign
title, the amount the donor entered (as a string, `amountNum.toString()`), the connected wallet
address (empty string if unavailable) and `new Date().toISOString()` as the donation date.

## Receipt contents

| Field              | Source                                      | Notes                                                                                                                        |
| ------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Issuer name        | `PLATFORM_NAME` = `ProofOfHeart` (constant) | Shown in the subtitle and footer.                                                                                            |
| Issuer Tax ID      | `NEXT_PUBLIC_PLATFORM_TAX_ID`               | **Falls back to the placeholder `XX-XXXXXXX`** when unset or blank.                                                          |
| Receipt Issue Date | Generation time, `YYYY-MM-DD` (UTC)         | Not a sequential receipt number.                                                                                             |
| Donation Date      | `donationDate` truncated to `YYYY-MM-DD`    | ISO date, UTC.                                                                                                               |
| Campaign           | `campaignTitle`                             | Creator-supplied text.                                                                                                       |
| Donation Amount    | `amountXlm` + " XLM"                        | Native-asset amount only; **no fiat value**.                                                                                 |
| Donor Address      | `donorAddress`                              | Stellar public key; no name or postal address.                                                                               |
| Transaction Hash   | `transactionHash`                           | Lets anyone verify the donation on a block explorer.                                                                         |
| Footer statement   | Fixed text                                  | "This receipt serves as an official record of your donation for tax purposes. Please retain this document for your records." |

## API

```ts
interface TaxReceiptData {
  transactionHash: string; // Stellar transaction hash
  campaignTitle: string;
  amountXlm: string; // decimal string, e.g. "10.5"
  donorAddress: string; // donor's Stellar public key
  donationDate: string; // ISO 8601 date-time
}

function downloadTaxReceipt(data: TaxReceiptData): void;
```

- Browser-only: it uses `Blob`, `URL.createObjectURL` and `window.open`. Do not call it during SSR.
- Must be called from a user gesture (a click), otherwise the pop-up is blocked.
- Returns nothing and reports no failure; a blocked pop-up is silent.

## Configuration

| Variable                      | Purpose                                 | Default                    |
| ----------------------------- | --------------------------------------- | -------------------------- |
| `NEXT_PUBLIC_PLATFORM_TAX_ID` | Tax identifier printed on every receipt | `XX-XXXXXXX` (placeholder) |

It is a public, build-time value (see [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)). Set it
in the production build environment; **never ship production with the placeholder**.

## Behaviour and limits

- **Amount precision:** the amount is whatever string the dialog passes; it is printed as-is, with
  no rounding or localisation. Receipts are always English (`lang="en"`) with ISO dates.
- **Asset:** every amount is labelled XLM. Contributions in other supported tokens would be
  mislabelled unless the caller changes the label — extend `TaxReceiptData` first (see below).
- **Time:** the "Donation Date" is the moment the receipt is generated after success, not the
  ledger close time of the transaction.
- **Recurring donations:** a receipt covers one transaction hash; there is no annual summary.
- **Printing:** the page calls `window.print()` as soon as it loads; the user can cancel and print
  later from the window.
- **No integrity protection:** the receipt is unsigned and editable HTML. The transaction hash is
  the verifiable part; a recipient organisation should verify it on-chain, not trust the document.

## Security considerations

These are properties of the current implementation that maintainers should know:

1. **Unescaped interpolation.** `campaignTitle`, `donorAddress` and `transactionHash` are inserted
   into the HTML template without escaping. `campaignTitle` is written by the campaign creator, so
   a title containing markup is rendered as markup in the receipt window, and that window is a
   `blob:` URL that shares the application's origin. Escape `& < > " '` in every interpolated value
   (or build the DOM with `textContent`) before relying on this feature for untrusted campaigns.
2. **Content Security Policy.** Documents opened from a `blob:` URL inherit the policy of the page
   that created them. The production policy forbids inline scripts without a nonce
   (see [PRE_COMMIT_SETUP.md](../PRE_COMMIT_SETUP.md#content-security-policy-csp-maintenance)), so the
   inline `window.print()` call in the template may be blocked in production, leaving the donor to
   print manually. Verify in a production build and, if needed, call `w.print()` from the opener
   instead of an inline script.
3. **Object URL lifetime.** The blob URL is revoked one second after the window loads (or at once
   if the pop-up was blocked), so it cannot be reopened.
4. **Personal data.** The receipt contains the donor's wallet address only. It is generated and
   discarded client-side; the application does not transmit it.

## Compliance checklist

Confirm each item with counsel and record the decision here or in the release notes:

- [ ] **Issuer identity.** The platform's legal name, registration number and `NEXT_PUBLIC_PLATFORM_TAX_ID`
      are correct, and the platform is legally permitted to issue donation receipts in each target
      jurisdiction. If donations are received by the campaign creator or another entity, that
      entity may be the correct issuer.
- [ ] **Footer wording.** "Official record … for tax purposes" is acceptable. Many regimes require
      specific statements (charity registration number, "no goods or services provided", deductibility
      language) — none are present today.
- [ ] **Fiat valuation.** Tax authorities usually need the value in local currency at the time of the
      gift. The receipt shows XLM only; decide on a rate source and add it.
- [ ] **Donor identification.** Some regimes require the donor's name and address; the receipt has
      only a wallet address.
- [ ] **Receipt numbering and retention.** Sequential numbering and issuer-side records are often
      mandatory. There is neither; each receipt is generated on demand.
- [ ] **Recipient eligibility.** Campaigns are created by arbitrary users. Decide whether a receipt
      should be offered for every campaign or only for verified or eligible recipients.
- [ ] **Data protection.** Confirm that a wallet address shown on a printed document and the
      client-side-only handling are acceptable under applicable privacy law.
- [ ] **Localisation.** English-only receipts may not satisfy local-language requirements.

## Extending the receipt

When adding fields (asset code, fiat value, receipt number, issuer registration number):

1. Add the field to `TaxReceiptData`, make the caller in `DonationModal.tsx` pass it, and update the
   table in [Receipt contents](#receipt-contents).
2. Escape every interpolated value (see Security considerations).
3. Keep the template self-contained — no external fonts, images or scripts — so it works offline and
   under the CSP.
4. Add tests (below) and, for new legal wording, link the approval in the PR.

## Testing

There is currently no dedicated unit test for `src/lib/taxReceipt.ts`; `DonationModal.test.tsx`
covers the dialog around it. A good test mocks `window.open`, `URL.createObjectURL` and
`URL.revokeObjectURL`, calls `downloadTaxReceipt` with fixed data and asserts:

- the generated Blob contains the campaign title, amount, donor address, hash and the Tax ID;
- the placeholder `XX-XXXXXXX` appears only when `NEXT_PUBLIC_PLATFORM_TAX_ID` is unset;
- markup in `campaignTitle` is escaped (add this together with the escaping fix);
- the object URL is revoked immediately when `window.open` returns `null`.

## Related

- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md), [SECURITY.md](./SECURITY.md),
  [STELLAR_AMOUNT.md](./STELLAR_AMOUNT.md), [troubleshooting.md](./troubleshooting.md)
