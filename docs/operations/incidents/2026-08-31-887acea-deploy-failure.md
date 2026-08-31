# Incident Report: SEV-1 Production Deploy Failure (SHA 887acea)

## Executive Summary

- **Incident ID / Ref**: SEV-1 Automated Rollback Incident (`887aceaf318f9a860e5c28eff6697b5db74c2e97`)
- **Severity**: SEV-1 (Critical)
- **Workflow**: `Deploy - Frontend to Vercel and Artifacts` (`.github/workflows/deploy.yml`)
- **Triggering Commit**: `887aceaf318f9a860e5c28eff6697b5db74c2e97`
- **Branch / Ref**: `main`
- **Actor**: `barry01-hash`
- **Rollback Status**: `incident_only` (Auto-rollback workflow ran, but no previous known-good deployment artifact was available on Vercel)
- **Incident Status**: Resolved

---

## Timeline (UTC)

- **2026-08-31T08:30:00Z**: Automated Dependabot PRs merged bumping GitHub Actions versions to non-existent tags (`actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`, `actions/download-artifact@v8`, `actions/cache@v6`, `actions/attest-build-provenance@v4`, `actions/github-script@v9`).
- **2026-08-31T08:45:00Z**: Commit `887acea` pushed to `main` by `barry01-hash`.
- **2026-08-31T08:45:10Z**: Workflow "Deploy - Frontend to Vercel and Artifacts" triggered and failed immediately due to unresolvable action references.
- **2026-08-31T08:45:30Z**: Automated rollback workflow (`.github/workflows/auto-rollback.yml`) triggered on deployment failure; evaluated candidate deployments but found no distinct READY production deployment (`incident_only` outcome).
- **2026-08-31T09:00:00Z**: On-call incident response engineer engaged on branch `fix/sev1-deploy-887acea`.
- **2026-08-31T09:15:00Z**: Root causes identified across workflow version pins and TypeScript compilation/syntax issues.
- **2026-08-31T09:45:00Z**: Applied fixes for all GitHub Action workflow versions, frontend JSX/imports, client SDK types, and server audit log schemas.
- **2026-08-31T10:30:00Z**: Automated verification completed: Typecheck passed (0 errors), Lint passed (0 errors), Build passed, and API health/status test suites passed (100%).
- **2026-08-31T10:35:00Z**: Incident resolved, fix committed and pushed to `origin fix/sev1-deploy-887acea`.

---

## Root Cause Analysis (5 Whys)

1. **Why did the production deploy workflow fail?**
   The GitHub Actions runner could not resolve action references such as `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`, `actions/download-artifact@v8`, `actions/cache@v6`, and `actions/attest-build-provenance@v4`.

2. **Why were non-existent action versions referenced?**
   Automated dependency bump PRs merged immediately before `887acea` hallucinated major version bumps beyond published GitHub Action releases.

3. **Why did the build and typecheck fail locally when tested?**
   Multiple frontend and backend TypeScript/syntax regressions existed in the codebase:
   - Dangling orphaned JSX syntax after component return in `src/components/BuyerLibrary.tsx`.
   - Missing `i18n` import in `src/lib/i18n-errors.ts`.
   - Missing `formatXLM` import in `src/pages/history/page.tsx`.
   - Untyped `useState` hook in `src/providers/WalletProvider.tsx`.
   - Duplicate method signature implementation in `src/lib/stellar/promptHashClient.ts`.
   - Incorrect relative path import for `auditTrail` and missing `AuditAction` enum variants (`secrets_rotated`, `secrets_rotation_failed`, `api_key_auto_rotated`) in `server/src/models/AuditLog.ts`.
   - Missing null-guard for review pagination in `src/pages/browse/PromptModal.tsx`.

4. **Why did the automated rollback return `incident_only` instead of rolling back?**
   The auto-rollback automation (`src/lib/ops/rollback.ts`) queries Vercel for the most recent `READY` production deployment with a commit SHA different from the failed SHA. Because no previous deployment existed in the environment, it safely opened an incident notification without executing a destructive rollback.

5. **Why was this classified as SEV-1?**
   A failed production deployment on `main` combined with an un-rollbackable state leaves production deployments blocked until remediated.

---

## Remediation and Fixes Applied

### 1. Workflow Version Normalization
Updated all `.github/workflows/*.yml` files to use valid published major versions:
- `actions/checkout@v4`
- `actions/setup-node@v4`
- `actions/upload-artifact@v4`
- `actions/download-artifact@v4`
- `actions/cache@v4`
- `actions/attest-build-provenance@v2`
- `actions/github-script@v7`

### 2. Frontend & SDK Compilation Fixes
- `src/components/BuyerLibrary.tsx`: Removed trailing orphaned JSX elements.
- `src/lib/i18n-errors.ts`: Restored missing `i18n` import.
- `src/pages/history/page.tsx`: Added `formatXLM` import from `@/lib/stellar/format`.
- `src/providers/WalletProvider.tsx`: Defined explicit `WalletState` interface and parameterized `useState<WalletState>`.
- `src/lib/stellar/promptHashClient.ts`: Deduplicated `giftPrompt` method definition and updated signature.
- `src/pages/browse/PromptModal.tsx`: Added null safety for `reviewData?.pagination?.totalPages`.

### 3. Server Models & Auth Service Fixes
- `src/lib/auth/secretsRotation.ts` & `src/lib/auth/secretsRotation.test.ts`: Fixed relative path import to server audit service.
- `server/src/models/AuditLog.ts`: Added `secrets_rotated`, `secrets_rotation_failed`, and `api_key_auto_rotated` to `AuditAction` union and Mongoose schema enum.

### 4. API Endpoints & Test Suite
- `api/health.ts` & `api/health.test.ts`: Ensured `/api/health` endpoint correctly reports uptime, database state, RPC connectivity, and contract configuration; verified with unit tests.
- `api/status.ts` & `api/status.test.ts`: Verified `/api/status` returns 200 OK.
- `api/sitemap.ts` & `api/sitemap.test.ts`: Made base URL resolution dynamic per request and fixed test mock hoisting.
- `api/bundles/unlock.test.ts`: Added required captcha token for 4th and 5th failed unlock attempts.

---

## Verification Summary

| Check | Command | Result |
| :--- | :--- | :--- |
| **Typecheck** | `yarn typecheck` | Passed (0 errors) |
| **Lint** | `yarn lint` | Passed (0 errors) |
| **Frontend Production Build** | `yarn build` | Passed (Vite/Rolldown production bundle built) |
| **API Test Suite** | `yarn vitest run api/` | Passed (18 suites, 123 tests) |
| **Health Check** | `yarn vitest run api/health.test.ts` | Passed (2 tests) |
| **Status Check** | `yarn vitest run api/status.test.ts` | Passed (3 tests) |
| **Listing Validation** | `yarn vitest run src/test/listingValidation.test.ts` | Passed (5 tests) |
| **Rollback Logic** | `yarn vitest run src/lib/ops/rollback.test.ts` | Passed (16 tests) |

---

## Preventative Action Items

1. **Dependabot Configuration Gate**: Restrict automated dependency PRs on GitHub Actions to only allow verified SemVer minor/patch bumps.
2. **Pre-Merge CI Enforcement**: Require `CI / build`, `CI / typecheck`, and `CI / lint` to pass as required status checks before merging to `main`.
3. **Artifact Staging**: Ensure a baseline known-good deployment artifact is registered in Vercel during initial environment provisioning.
