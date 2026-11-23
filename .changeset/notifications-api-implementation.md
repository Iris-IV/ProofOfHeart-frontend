---
"proofofheart-frontend": patch
---

Implement `/api/notifications` endpoint with GET and PATCH methods

- GET endpoint fetches notifications for a wallet address from local transaction log or remote API
- PATCH endpoint marks single or multiple notifications as read
- Includes comprehensive test coverage
- Supports both `walletAddress` and `address` query parameters
- Returns proper error responses for invalid inputs
- Closes #1815
