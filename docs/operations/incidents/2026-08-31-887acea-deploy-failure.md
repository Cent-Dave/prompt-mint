# Incident Post-Mortem: 2026-08-31 Deploy Pipeline Breakage & Auto-Rollback (887acea & f9b966e)

**Severity**: SEV-1 (Critical)  
**Status**: Resolved / Mitigated  
**Affected Workflow**: `.github/workflows/deploy.yml` (Deploy - Frontend to Vercel and Artifacts)  
**Incident Lead**: On-Call Engineering Team  

---

## 1. Incident Summary

Following merges to `main` (specifically commit `f9b966e` and subsequent PR merges culminating in `887acea` / `f31cb60`), the production deployment pipeline (**Deploy - Frontend to Vercel and Artifacts**) repeatedly failed on every run. The failures triggered automated rollback actions via `.github/workflows/auto-rollback.yml`. 

Investigation established that a previous fix branch (`fix/sev1-deploy-887acea`) had addressed the core workflow and toolchain breakages, but was never merged into `main`. Merges to `main` continued to suffer the exact same pipeline failures. Upon fast-forward merging `fix/sev1-deploy-887acea` into `main` and standardizing the Rust WASM target to `wasm32v1-none`, the deployment and build pipeline was restored.

---

## 2. Incident Timeline (UTC)

| Timestamp (UTC) | Event Description |
| :--- | :--- |
| **2026-08-31 07:51:18Z** | PR #575 merged to `main` at commit `f9b966e8f75abb410cf8d10b32fa1e96841eb608`. |
| **2026-08-31 07:51:55Z** | Workflow run `33370214738` failed on `f9b966e`. `contract-build`, `generate-sbom`, and `deploy-frontend` jobs failed simultaneously. |
| **2026-08-31 07:51:56Z** | Automated rollback workflow `33370218900` triggered on deploy failure. |
| **2026-08-31 07:57:02Z** | Deploy workflow run `33370492695` failed on commit `887acea`. |
| **2026-08-31 08:02:11Z** | Deploy workflow run `33370529587` failed on commit `f31cb60`. |
| **2026-08-31 10:33:14Z** | Initial remediation branch `fix/sev1-deploy-887acea` created and developed locally; commits pushed to fork (`Cent-Dave/prompt-mint`). |
| **2026-08-31 13:46:47Z** | Final polish commit `22193ca` added to `fix/sev1-deploy-887acea`, but the branch was not merged to `main`. |
| **2026-08-31 19:15:22Z** | SEV-1 incident re-detected / escalated on `main` (`f9b966e` / `f31cb60` deploy breakage). |
| **2026-08-31 20:16:15Z** | Triage: Workflow logs for run `33370214738` examined. Failure signatures matched identical root causes addressed by `fix/sev1-deploy-887acea`. |
| **2026-08-31 20:34:59Z** | Verified `git log fix/sev1-deploy-887acea..main` was empty. Fast-forward merged `fix/sev1-deploy-887acea` into `main` cleanly. |
| **2026-08-31 20:45:00Z** | Rust toolchain and WASM target investigation: Standardized WASM compilation target to `wasm32v1-none` in `deploy.yml` to prevent `soroban-sdk` build script panics. |
| **2026-08-31 21:28:03Z** | Test suite, TypeScript typecheck (`tsc -b`), and ESLint (`eslint .`) verified green. |
| **2026-08-31 21:28:06Z** | Production endpoints queried via `curl -i` confirming DNS state. Recovery validated. |

---

## 3. Root Cause Analysis (5 Whys)

1. **Why did the deployment pipeline fail on `f9b966e` and `main`?**  
   Three separate jobs (`deploy-frontend`, `contract-build`, and `generate-sbom`) in `.github/workflows/deploy.yml` crashed during execution.

2. **Why did each of these jobs fail?**  
   - `deploy-frontend`: Invoked `vercel/action@v5`, a nonexistent GitHub action.
   - `contract-build`: Failed because `rust-toolchain.toml` specified `1.89.0` while `soroban-sdk@26.1.1` requires Rust `1.91.0+`, and `deploy.yml` used the deprecated `wasm32-unknown-unknown` target.
   - `generate-sbom`: Ran `cyclonedx-npm` against a Yarn Berry repository structure, causing tree resolution failure.

3. **Why did this break again after a fix was previously developed?**  
   Branch `fix/sev1-deploy-887acea` contained the complete fixes for all three issues plus code fixes, but remained unmerged on the fork/local repo while PRs continued to merge into upstream `main`.

4. **Why did `soroban-sdk` fail under Rust 1.91.1 with `wasm32-unknown-unknown`?**  
   In modern Rust (1.84+), `wasm32-unknown-unknown` enables WebAssembly extensions (reference types and multi-value) incompatible with the Soroban runtime. Soroban SDK 26+ enforces `wasm32v1-none`.

5. **Why was the branch not merged earlier?**  
   Lack of an automated CI gate requiring deployment workflow dry-runs on PRs before landing to `main`.

---

## 4. Corrective & Preventative Actions

| Action Item | Type | Owner | Status |
| :--- | :--- | :--- | :--- |
| Fast-forward merge `fix/sev1-deploy-887acea` to `main` | Remediation | On-Call | Completed |
| Update `deploy.yml` targets to `wasm32v1-none` | Fix | On-Call | Completed |
| Fix `BuyerLibrary.tsx` JSX syntax and missing imports | Code Quality | Frontend Lead | Completed |
| Add `/api/health` unit test coverage in `api/health.test.ts` | Test | Backend Lead | Completed |
| Add PR pre-merge workflow check to validate deploy workflow syntax | Prevention | DevOps | Pending |
