---
name: git pull waits on MERGE_MSG
description: User's git pull from GitHub stalls waiting for the Replit editor to close MERGE_MSG; how to finish it and what to check after.
---

The user pulls collaborator work from GitHub in the Shell often. Local history diverges (Replit "Published your App" commits), so every pull makes a merge commit and stops at "Waiting for your editor to close the file" with MERGE_MSG open.

**Why:** the user has sent the stuck screen several times and did not run the suggested git config change. Each pull can include a new Drizzle migration.

**How to apply:** check `ps` first because a new pull may be waiting even if an earlier one was finished. Kill only that pull's PIDs, including the replit-git-editor bash and curl processes. Then run `git commit -m "Merge branch 'main' of …"`. Afterwards, check for new `drizzle/*.sql` files, run `npm run db:migrate`, and run typecheck and tests. Then check `explainSchemaDiff` before telling the user to republish. Closing the MERGE_MSG tab also completes the merge.

Fix agreed with the user on 2026-10-20: set the development env var `GIT_MERGE_AUTOEDIT=no`. Replit sets its own GIT_EDITOR, which overrides `core.editor`, so changing git config does not help. The env var only takes effect in Shell tabs opened after it was set. If a pull still stalls, first check that the variable is visible in that Shell.

Risk now that pulls finish without me: the user can republish before any dev migration runs. Publish only diffs the dev schema against prod, so a new table is left out and its page fails in production with "relation does not exist" (this happened with the stock table on 2026-10-20). When a production error says a relation or column is missing, run `npm run db:migrate` in dev, check `explainSchemaDiff`, then ask the user to republish.
