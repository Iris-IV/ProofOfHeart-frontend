---
"proofofheart-frontend": patch
---

Fix `@typescript-eslint/require-await` ESLint violations

- Remove unnecessary `async` keywords from functions that don't use `await`
- Ensures consistent async function usage across the codebase
- Improves code clarity and prevents misleading async signatures
- Part of resolving #1750
