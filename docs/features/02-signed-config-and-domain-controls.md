# Signed Config and Domain Controls

## Purpose
Ensure runtime config is authentic and allowed for the current host.

## How it works
- Config API returns payload with `config`, feature flags, domain-allow result, validity window, version hash, and signature.
- Loader verifies Ed25519 signature using embedded public key.
- Loader enforces:
  - `allowed === true`
  - `killSwitch === false`
  - current time within `notBefore` and `notAfter`
- If any check fails, runtime boot is aborted.

## Key files
- `packages/loader/src/index.ts`
- `services/config-api/src/index.ts`
- `packages/shared/src/types/index.ts`
