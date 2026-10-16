---
"proofofheart-frontend": patch
---

Make npm the only package manager: regenerate package-lock.json so `npm ci` works, drop the pnpm lockfile and workspace file, and fail CI if a second lockfile returns.
