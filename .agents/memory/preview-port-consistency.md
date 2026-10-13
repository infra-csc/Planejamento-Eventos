---
name: Preview port consistency
description: Next.js readiness versus Replit workflow port detection and forwarding.
---

Keep the webview workflow's port, primary external-80 mapping, declared PORT and application start commands consistent. A Next.js Ready message alone does not verify the preview.

**Why:** a workflow listening on 5000 repeatedly timed out while the primary port mapping and production command still specified 3000. Aligning the configuration restored the workflow, including while the isolated browser-test server was running.

**How to apply:** use 5000 for this app's webview and keep publication's start command compatible with the primary mapping. Isolated test servers may use separate mappings but must not replace the main one. Inspect mappings before repeating restarts after a port-detection failure.
