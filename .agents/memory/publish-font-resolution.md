---
name: Publish-time font resolution
description: Why this app keeps web fonts bundled rather than resolving Google fonts during publishing.
---

Use bundled font files for the app's typography instead of relying on `next/font/google` during a production build.

**Why:** A Replit Publish build failed inside Turbopack's Google font resolver with “next/font/google queries have exactly one entry,” while the same clean install and build passed locally. The difference was specific to the publishing environment, so local build success did not rule it out.

**How to apply:** When adjusting fonts, preserve build-time independence from Google Fonts. Verify a clean install and build, but if a future publish fails in font resolution despite local success, inspect the publish logs before changing unrelated app code.