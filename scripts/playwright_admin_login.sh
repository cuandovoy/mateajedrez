#!/usr/bin/env bash
set -euo pipefail

# Config (override with env vars)
BASE_URL="${BASE_URL:-http://127.0.0.1:4173}"
LOGIN_PATH="${LOGIN_PATH:-/login}"
ARTIFACT_DIR="${ARTIFACT_DIR:-output/playwright/admin-login}"
PW_SESSION="${PW_SESSION:-admin-login}"
PW_HEADED="${PW_HEADED:-0}"

if ! command -v npx >/dev/null 2>&1; then
  cat <<'EOM'
Error: npx is required but not found on PATH.

Install/verify Node.js + npm first:
# Verify Node/npm are installed
node --version
npm --version

# If missing, install Node.js/npm, then:
npm install -g @playwright/cli@latest
playwright-cli --help
EOM
  exit 1
fi

if [[ -z "${ADMIN_EMAIL:-}" || -z "${ADMIN_PASSWORD:-}" ]]; then
  echo "Error: set ADMIN_EMAIL and ADMIN_PASSWORD before running." >&2
  exit 1
fi

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="${PWCLI:-$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh}"

if [[ ! -f "$PWCLI" ]]; then
  echo "Error: Playwright wrapper not found at: $PWCLI" >&2
  exit 1
fi

mkdir -p "$ARTIFACT_DIR"
cd "$ARTIFACT_DIR"

echo "[1/8] Opening login page: ${BASE_URL}${LOGIN_PATH}"
if [[ "$PW_HEADED" == "1" ]]; then
  bash "$PWCLI" --session "$PW_SESSION" open "${BASE_URL}${LOGIN_PATH}" --headed
else
  bash "$PWCLI" --session "$PW_SESSION" open "${BASE_URL}${LOGIN_PATH}"
fi

echo "[2/8] Capturing pre-login snapshot"
bash "$PWCLI" --session "$PW_SESSION" snapshot | tee 01-login.snapshot.txt >/dev/null

echo "[3/8] Waiting for login form"
bash "$PWCLI" --session "$PW_SESSION" run-code "await page.getByLabel('Email').waitFor({ state: 'visible', timeout: 15000 });"

# Use semantic selectors instead of fragile element refs.
echo "[4/8] Filling credentials"
bash "$PWCLI" --session "$PW_SESSION" run-code "await page.getByLabel('Email').fill(process.env.ADMIN_EMAIL || '');"
bash "$PWCLI" --session "$PW_SESSION" run-code "await page.getByLabel('Contraseña').fill(process.env.ADMIN_PASSWORD || '');"

echo "[5/8] Submitting login"
bash "$PWCLI" --session "$PW_SESSION" run-code "await page.getByRole('button', { name: 'Iniciar Sesión' }).click();"

echo "[6/8] Waiting for admin dashboard"
bash "$PWCLI" --session "$PW_SESSION" run-code "await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 30000 });"
bash "$PWCLI" --session "$PW_SESSION" run-code "await page.getByRole('heading', { name: 'Panel de Administración' }).waitFor({ state: 'visible', timeout: 30000 });"

echo "[7/8] Capturing dashboard artifacts"
bash "$PWCLI" --session "$PW_SESSION" snapshot | tee 02-dashboard.snapshot.txt >/dev/null
bash "$PWCLI" --session "$PW_SESSION" run-code "await page.screenshot({ path: '03-dashboard.png', fullPage: true });"

echo "[8/8] Closing browser session"
bash "$PWCLI" --session "$PW_SESSION" close

echo "Done. Artifacts written to: $ARTIFACT_DIR"
