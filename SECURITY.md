# Security Policy

## Supported Versions

catalog is currently in active pre-release development. Security updates are applied to the latest version:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

As a young project not yet at version 1.0, all users are encouraged to keep up with the latest releases.

## Reporting a Vulnerability

**Please do not open a public issue to report a security vulnerability.**

Instead, use GitHub's private vulnerability reporting feature:

1. Go to https://github.com/xooxoxxo/catalog/security/advisories/new
2. Click "Report a vulnerability" in the Security tab of the repository
3. Follow the disclosure form to describe the issue

We aim to acknowledge vulnerability reports within a few days and will work with you to understand and address the issue. This is a small, volunteer-maintained project, so please be patient as we investigate and prepare a fix.

## Security Model & Scope

### Local-First Architecture

catalog is designed as a **local-first** desktop application. The app does not upload any data, tool metadata, or system information to remote servers. All data remains on your machine.

### LLM Enrichment

When using AI enrichment features, catalog invokes a user-configured large language model provider via a CLI command in a temporary, sandboxed working directory. The enrichment workflow:

- Extracts tool metadata only (names, descriptions, basic attributes)
- Does **not** send system information, personal files, or sensitive data to the LLM
- Runs in an isolated, temporary directory
- Respects the user's privacy and local data

### GitHub OAuth Token Storage

The app stores GitHub OAuth tokens in the **macOS Keychain** using native secure storage. Tokens:

- Are never exposed to the web layer
- Are never sent to remote servers except GitHub's own API
- Are encrypted by the operating system's security infrastructure

### Known Limitations

- **Unsigned Builds**: macOS app builds are currently unsigned. Users may encounter Gatekeeper warnings on first run. We plan to implement code signing in a future release.
- **Rust Toolchain**: The project uses standard Rust tooling and dependencies. Keep your Rust toolchain and npm dependencies updated for the latest security patches.

## Code Signing & Binary Distribution

catalog is currently distributed as source code for users to build locally. As the project matures, we plan to publish code-signed macOS app releases. In the interim, users building from source can verify their build matches the git repository state.

## Dependency Management

- JavaScript dependencies are managed via npm with a committed lock file
- Rust dependencies are managed via Cargo with a committed lock file
- We encourage users and contributors to report dependency vulnerabilities

## Contributing Securely

When contributing code:

- Do not commit credentials, API keys, or private tokens
- Use the `.gitignore` patterns already in place
- Follow the [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
