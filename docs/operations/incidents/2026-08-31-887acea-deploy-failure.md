# Incident: 2026-08-31 Deploy Failure (887acea)

### Root Cause Analysis
The deployment pipeline failure was caused by three distinct misconfigurations, exacerbated by an automated agent unnecessarily downgrading action versions during initial triage:

1. **Deploy Job:** Attempted to use a nonexistent GitHub Action (`vercel/action@v5`). Corrected to the community-standard `amondnet/vercel-action@v42`.
2. **Contract Build Job:** Failed due to an outdated Rust toolchain (`1.89.0`) incompatible with `soroban-sdk@26.1.1`. Toolchain bumped to `1.91.1` (skipping `1.91.0` due to a known Wasm linker regression) and the `wasm32-unknown-unknown` target was explicitly added.
3. **Generate SBOM Job:** Failed because it used `cyclonedx-npm` against a Yarn-managed dependency tree. Replaced with `@cyclonedx/yarn-plugin-cyclonedx`.

*Note: Previous AI interventions downgraded several v7/v8 core actions (checkout, setup-node, cache) to v4/v3. These were red herrings and have been reverted to their modern versions across all workflow files.*
