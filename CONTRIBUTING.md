# Contributing to ProofOfHeart

We welcome contributions! To maintain a clean and consistent codebase, please follow these guidelines.

## Development Workflow

1.  **Branching**: Create a descriptive branch for your changes (e.g., `feat/add-onboarding` or `fix/login-error`).
2.  **Linting**: Run `npm run lint` before committing.
3.  **Testing**: Ensure tests pass by running `npm test`.
4.  **Bundle Analysis**: To inspect the bundle size and composition, run:
    ```bash
    npm run analyze
    ```
    This will generate an HTML report in the `.next/analyze` folder (or open it automatically in your browser). Use this to identify and resolve bundle bloat.

## Pull Requests

- Provide a clear description of the changes.
- Reference any related issues.
- Ensure your code builds locally (`npm run build`).
