# AGENTS GUIDE

## Engineering Principles

- Validate untrusted input at application boundaries and enforce authorization server-side.
- Keep application-specific code in its owning app; extract shared code only after a real second use case exists.
- Prefer small, focused changes. Avoid unrelated refactors in feature or bug-fix work.

## Before Submitting Changes

- Run the formatter, linter, type checker, and relevant tests once project tooling is established.
- Add or update tests for changed business behavior, especially inventory calculations and permissions.
- Update documentation when public behavior, setup, environment variables, or architecture changes.
- Do not commit credentials, production data, or generated build artifacts.

## Working With This Repository

- Check for more-specific `AGENTS.md` files before modifying a subdirectory; the closest applicable file takes precedence.
- Preserve existing conventions in each application or package.
- Record new development, test, and build commands in the root README when the toolchain is introduced.
