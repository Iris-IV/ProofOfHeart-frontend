---
"proofofheart-frontend": patch
---

Decode campaign status from the contract bitfield, send create_campaign as one CreateCampaignParams struct with an optional per-wallet cap, and return the contract-assigned campaign id.
