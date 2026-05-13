/**
 * Centralized test credentials.
 *
 * Reads from SEED_DEFAULT_PASSWORD env var so committed source contains no
 * high-entropy literal that secret scanners could flag. The fallback string
 * is intentionally low-entropy and obviously non-secret; if it ever reaches
 * the seeded database (env var unset), every test login will fail loudly,
 * surfacing the misconfiguration rather than masking it.
 *
 * Configuration sources:
 *   - Local dev:  set in .env (gitignored)
 *   - CI:         set in .github/workflows/ci-security.yml env block
 *
 * The prisma/seed.ts script must read from the same env var so seeded
 * users and test logins stay in sync.
 */
export const TEST_PASSWORD =
  process.env.SEED_DEFAULT_PASSWORD ?? '<DEV_SEED_PASSWORD>';
