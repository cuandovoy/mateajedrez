# Playwright CLI automation: Admin login flow

This script automates:
1. Open `/login`
2. Fill admin credentials
3. Submit login
4. Assert dashboard heading (`Panel de Administración`)
5. Save artifacts to `output/playwright/admin-login/`

## Prerequisites

- App running locally (default: `http://127.0.0.1:4173`)
- `npx` available
- Valid admin credentials

## Run

```bash
# Terminal 1: run app
npm run dev -- --host 127.0.0.1 --port 4173

# Terminal 2: run browser automation
export ADMIN_EMAIL="admin@example.com"
export ADMIN_PASSWORD="your-password"
bash scripts/playwright_admin_login.sh
```

## Optional variables

```bash
export BASE_URL="http://127.0.0.1:4173"
export LOGIN_PATH="/login"
export ARTIFACT_DIR="output/playwright/admin-login"
export PW_SESSION="admin-login"
export PW_HEADED=1
```

Then run:

```bash
bash scripts/playwright_admin_login.sh
```

## Output artifacts

- `output/playwright/admin-login/01-login.snapshot.txt`
- `output/playwright/admin-login/02-dashboard.snapshot.txt`
- `output/playwright/admin-login/03-dashboard.png`
