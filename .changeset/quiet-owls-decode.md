---
"proofofheart-frontend": patch
---

Decode campaign lifecycle from the contract's `status` bitfield, mirror the new `Campaign` fields, and send `create_campaign` as a single `CreateCampaignParams` struct with an optional per-wallet contribution cap. Creation now returns the contract-assigned campaign id, and tags, cover images and milestones are carried in the description blob again.
