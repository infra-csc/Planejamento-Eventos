---
name: Publish package firewall
description: Publish builds fail with npm E403 when a dependency version has a critical CVE; local installs still work.
---

The publish builder downloads npm packages through a security firewall. It refuses versions that have a critical CVE ("Blocked by Security Policy. Reason: Critical CVE", npm E403). The workspace install and local build still pass because the packages are already in node_modules.

**Why:** on 2026-10-22, next 16.3.6 was blocked after critical RCE advisories, and two publishes failed in about 30s right after npm install. Upgrading next and eslint-config-next to 16.4.2 fixed it.

**How to apply:** when a publish fails quickly in "Starting Build", read the build log with listDeploymentBuilds/getDeploymentBuild (not fetchDeploymentLogs) and look for E403. Fix it with the smallest upgrade that clears the critical findings in `npm audit`. Keep next and eslint-config-next on the same version.
