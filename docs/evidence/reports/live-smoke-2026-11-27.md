# Public deployment smoke check

**Date:** 2026-11-27  
**Target:** https://invigil-secure-exam-management-syst.vercel.app/  
**Hosting/database:** Vercel and Neon PostgreSQL, as confirmed by the user

Only unauthenticated HTTP GET requests were made.

| Route | HTTP result | Observation |
| --- | --- | --- |
| `/` | 200, HTML | Returned the Examora page title |
| `/api/healthz` | 200, JSON | `{"status":"ok"}` |
| `/api/session` | 200, JSON | `{"user":null,"demoEnabled":true}` |

The public site and API were reachable. These checks did not sign in, create
exams or attempts, change grades, run migrations, or write test fixtures.

This is not proof that every database migration or authenticated workflow is
correct. In particular, the unauthenticated responses do not independently
verify the Neon connection. Live database-writing tests require an explicitly
safe target.

Demo access was enabled at the time of the check. That is suitable only for an
intentional fictional-data demonstration, not a real-student production system.
