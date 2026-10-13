---
name: Preview port consistency
description: Dev workflow port vs. the publish port; the primary [[ports]] mapping reverts to 3000.
---

Dev preview runs on 5000 (`next dev -p 5000`, webview workflow). Production (`npm run start`) must listen on 3000, the first `localPort` in `.replit`.

**Why:** the primary [[ports]] block keeps reverting to localPort 3000 by itself, even right after being set to 5000, and checkpoints commit the reverted value. On 2026-10-13 a publish failed with "application failed to open a port in time" because `start` had been changed to `-p 5000` while the deployment waited on 3000. The last successful publishes all used 3000.

**How to apply:** never move the production start port away from 3000 unless the first [[ports]] localPort is confirmed to stay changed. Restart timeouts for the dev workflow happened while the isolated 3100 server and a browser tester were running; do not loop on restarts, verify with curl on 5000. Prefer node over python3 for ad-hoc scripts here.
