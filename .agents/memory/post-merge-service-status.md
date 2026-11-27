---
name: Post-merge service status
description: Interpreting replacement workflow failures when existing app processes survive a merge.
---

Treat managed workflow status and actual HTTP availability as separate observations after a merge.

**Why:** Repeated merge reconciliation in this workspace left an older application process serving requests while a replacement workflow failed because its port was occupied. A failed workflow did not mean the website was unavailable, and repeated starts did not address the ownership conflict.

**How to apply:** When a post-merge replacement reports an occupied port, establish which process belongs to the artifact and whether its endpoints respond before making code or port changes. Restore one managed instance; do not create duplicate workflows or assume a successful HTTP response proves the managed replacement started.
