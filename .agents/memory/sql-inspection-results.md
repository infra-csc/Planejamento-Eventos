---
name: SQL inspection results
description: Read-only metadata checks with the database callback.
---

Combine related read-only metadata checks into a single SELECT with scalar subqueries when using executeSql.

**Why:** a string containing several independent SELECT statements failed in the result formatter with an undefined-length error; the equivalent checks returned successfully as columns in one SELECT.

**How to apply:** avoid multiple result sets during schema inspection. This observation concerns result formatting, not evidence that the database is unreachable or that production should be modified.
