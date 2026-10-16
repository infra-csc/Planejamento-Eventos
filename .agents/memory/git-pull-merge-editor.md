---
name: git pull waits on MERGE_MSG
description: User's git pull from GitHub stalls waiting for the Replit editor to close MERGE_MSG; how to finish it and what to check after.
---

The user pulls collaborator work from GitHub in the Shell often. Local history diverges (Replit "Published your App" commits), so every pull makes a merge commit and stops at "Waiting for your editor to close the file" with MERGE_MSG open.

**Why:** the user has sent the stuck screen several times and did not run the suggested git config change. Each pull can include a new Drizzle migration.

**How to apply:** check `ps` first because a new pull may be waiting even if an earlier one was finished. Kill only that pull's PIDs, including the replit-git-editor bash and curl processes. Then run `git commit -m "Merge branch 'main' of …"`. Afterwards, check for new `drizzle/*.sql` files, run `npm run db:migrate`, and run typecheck and tests. Then check `explainSchemaDiff` before telling the user to republish. Closing the MERGE_MSG tab also completes the merge.
