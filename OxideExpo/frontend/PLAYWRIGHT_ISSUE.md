# Playwright Browser Display Issue

## Problem
Playwright tests cannot display a browser window when using VS Code's "Show browser" feature or `--ui` mode inside the dev container.

## Error Message
```
Looks like you launched a headed browser without having a XServer running.
Set either 'headless: true' or use 'xvfb-run <your-playwright-app>' before running Playwright.
```

## Environment
- **Platform**: WSL2 on Windows (Linux 6.6.87.2-microsoft-standard-WSL2)
- **Running in**: Docker dev container (`mcr.microsoft.com/devcontainers/base:noble`)
- **DISPLAY variable**: `:2`
- **X11 sockets exist**: Yes (`/tmp/.X11-unix/X0`, `X1`, `X2`)

## Root Cause
The dev container does not have X11 socket forwarding configured. The container cannot communicate with WSLg (Windows Subsystem for Linux GUI) running on the host WSL2 instance.

## Previous Behavior
The user reports that pressing play in VS Code opened a WSLg window (with characteristic "weird borders") yesterday. This suggests either:
1. The container was rebuilt and lost some state
2. They were running outside the container previously
3. WSLg/X11 socket binding was temporarily working

## Current devcontainer.json Status
Location: `/.devcontainer/devcontainer.json`

Missing X11 configuration:
- No X11 socket mount
- No DISPLAY environment variable set

## Proposed Fix
Add the following to `devcontainer.json`:

```json
"mounts": [
    "source=empleos-docker-volumes,target=/var/lib/docker/volumes,type=volume",
    "source=/tmp/.X11-unix,target=/tmp/.X11-unix,type=bind"
],
"containerEnv": {
    "DISPLAY": ":0"
}
```

Then rebuild the dev container:
1. `Ctrl+Shift+P` -> "Dev Containers: Rebuild Container"

## Workarounds (No Container Rebuild)

### Option 1: Run tests headless with HTML report
```bash
cd OxideExpo/frontend
npx playwright test
npx playwright show-report
```

### Option 2: Use trace viewer after test run
```bash
npx playwright test --trace on
npx playwright show-trace test-results/*/trace.zip
```

### Option 3: Run outside the container
Open a terminal directly in WSL2 (not through VS Code dev container) and run tests there.

## Related Files
- Playwright config: `OxideExpo/frontend/playwright.config.ts`
- VS Code settings: `.vscode/settings.json`
- Dev container config: `.devcontainer/devcontainer.json`
- Test file: `OxideExpo/frontend/e2e/v2-auth.spec.ts`

## Status
**UNRESOLVED** - Awaiting decision on whether to update devcontainer.json and rebuild.
