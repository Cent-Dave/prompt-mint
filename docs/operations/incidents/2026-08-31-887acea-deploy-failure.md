# Incident Post-Mortem: 2026-08-31 Deploy Pipeline Breakage & Auto-Rollback (887acea & f9b966e)

**Severity**: SEV-1 (Critical)  
**Status**: Fix Prepared Locally / Deployment Pending Remote Push  
**Affected Workflow**: `.github/workflows/deploy.yml` (Deploy - Frontend to Vercel and Artifacts)  
**Production Host**: `https://prompt-hash-stellar.vercel.app`  

---

## 1. Incident Summary

Following a series of merges to `main` (beginning with `f9b966e` and subsequent PR merges `887acea` and `f31cb60`), the production deployment workflow (**Deploy - Frontend to Vercel and Artifacts**) repeatedly failed on every commit. Each failure triggered `.github/workflows/auto-rollback.yml` to execute an automated rollback on Vercel.

Root cause analysis confirmed the failures were caused by:
1. An invalid action reference (`vercel/action@v5`) in the `deploy-frontend` job.
2. An outdated Rust toolchain (`1.89.0`) incompatible with `soroban-sdk@26.1.1` in `contract-build`, along with the deprecated `wasm32-unknown-unknown` target.
3. Invocation of `cyclonedx-npm` against a Yarn Berry dependency tree in `generate-sbom`.
4. Pre-existing TypeScript syntax errors in `src/components/BuyerLibrary.tsx` on `main`.

A previous fix branch (`fix/sev1-deploy-887acea`) had addressed these issues locally on the fork `Cent-Dave/prompt-mint`, but was never merged into `main`. The fix branch has now been fast-forward merged into local `main`, with WASM target standardization (`wasm32v1-none`) applied to `deploy.yml`.

---

## 2. Incident Timeline (UTC)

*All timestamps sourced directly from GitHub Actions workflow runs and git commit metadata.*

| Timestamp (UTC) | Source | Event Description |
| :--- | :--- | :--- |
| **2026-08-31 07:51:15Z** | Git Commit `f9b966e` | Commit authored on `main`. |
| **2026-08-31 07:51:18Z** | GitHub Actions Run `33370214738` | Deploy workflow triggered on commit `f9b966e`. |
| **2026-08-31 07:51:55Z** | GitHub Actions Run `33370214738` | Deploy workflow failed (`deploy-frontend`, `contract-build`, `generate-sbom` failed). |
| **2026-08-31 07:51:57Z** | GitHub Actions Run `33370261029` | Auto-rollback workflow triggered and executed. |
| **2026-08-31 07:55:02Z** | Git Commit `887acea` | Commit authored on `main`. |
| **2026-08-31 07:55:05Z** | GitHub Actions Run `33370492695` | Deploy workflow triggered on commit `887acea`. |
| **2026-08-31 07:55:50Z** | GitHub Actions Run `33370492695` | Deploy workflow failed. |
| **2026-08-31 07:55:31Z** | Git Commit `f31cb60` | Commit authored on `main`. |
| **2026-08-31 07:55:35Z** | GitHub Actions Run `33370529587` | Deploy workflow triggered on commit `f31cb60`. |
| **2026-08-31 07:56:46Z** | GitHub Actions Run `33370529587` | Deploy workflow failed. |
| **2026-08-31 09:33:14Z** | Git Commit `9ae4066` | Initial remediation commit on branch `fix/sev1-deploy-887acea`. |
| **2026-08-31 11:22:54Z** | Git Commit `8bc642f` | Corrected broken `vercel/action` to `amondnet/vercel-action@v42`. |
| **2026-08-31 11:43:35Z** | Git Commit `f11d363` | Bumped Rust toolchain to `1.91.1` for `soroban-sdk@26.1.1` compatibility. |
| **2026-08-31 12:24:21Z** | Git Commit `87dd5cf` | Switched to yarn-native `cyclonedx` plugin for SBOM generation. |
| **2026-08-31 12:27:39Z** | Git Commit `ad9cc30` | Reverted unnecessary action version downgrades in `deploy.yml`. |
| **2026-08-31 12:38:03Z** | Git Commit `c400e73` | Reverted unnecessary action version downgrades across remaining workflows. |
| **2026-08-31 12:46:47Z** | Git Commit `22193ca` | Bumped schema validation Rust toolchain to `1.91.1` (branch remained unmerged). |
| **2026-08-31 20:34:59Z (approx)** | Local Operation | Fast-forward merged `fix/sev1-deploy-887acea` into local `main`. |
| **2026-08-31 21:29:23Z** | Git Commit `a5cec5a` | Standardized `deploy.yml` target to `wasm32v1-none` and recorded incident post-mortem. |
| **2026-08-31 21:36:59Z** | Live HTTP Probe | Current production endpoints (`https://prompt-hash-stellar.vercel.app/api/health` and `/api/status`) probed, confirming 500 error on pre-fix deployment. Recovery pending deployment. |

---

## 3. Root Cause Analysis (5 Whys)

1. **Why did the deployment pipeline fail on `f9b966e`, `887acea`, and `f31cb60`?**  
   Three jobs in `.github/workflows/deploy.yml` (`deploy-frontend`, `contract-build`, and `generate-sbom`) crashed.

2. **Why did each job fail?**  
   - `deploy-frontend`: Referenced non-existent action `vercel/action@v5`.
   - `contract-build`: `rust-toolchain.toml` had `1.89.0`, incompatible with `soroban-sdk@26.1.1` (which requires Rust `1.91.0+`).
   - `generate-sbom`: Ran `cyclonedx-npm` which failed on the Yarn Berry lockfile/tree.

3. **Why did the issue recur on `main` after fixes were developed?**  
   Branch `fix/sev1-deploy-887acea` contained the complete fixes, but was not merged into upstream `main`. Subsequent PRs merged into `main` continued to trigger the unpatched workflow.

4. **Why did `soroban-sdk@26.1.1` panic under Rust 1.91.1 with `wasm32-unknown-unknown`?**  
   Rust 1.84+ enables WebAssembly feature extensions under `wasm32-unknown-unknown` that are unsupported by the Soroban runtime; Soroban SDK 26+ enforces `wasm32v1-none`.

5. **Why was the unmerged state not caught automatically?**  
   Pull requests did not run a dry-run of the deployment workflow prior to merge.

---

## 4. Corrective & Preventative Actions

| Action Item | Type | Owner | Status |
| :--- | :--- | :--- | :--- |
| Fast-forward merge `fix/sev1-deploy-887acea` to `main` | Remediation | On-Call | Completed locally |
| Update `deploy.yml` targets to `wasm32v1-none` | Fix | On-Call | Completed locally |
| Fix `BuyerLibrary.tsx` JSX syntax and missing imports | Code Quality | Frontend Lead | Completed locally |
| Add `/api/health` unit test coverage in `api/health.test.ts` | Test | Backend Lead | Completed locally |
| Deploy merged commit to Vercel and verify production `/api/health` | Validation | On-Call | Pending Remote Push & Deploy |

