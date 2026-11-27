---
name: Vercel API packaging
description: Why Vercel receives bundled JavaScript rather than workspace TypeScript.
---

Keep the Vercel API packaging step separate from the authoritative workspace TypeScript checks; ship the non-listening JavaScript app to the function runtime.

**Why:** Vercel's Node builder can choose NodeNext defaults before resolving inherited TypeScript options. Its `fixConfig` inspects inline options before parsing `extends`. Thus a workspace that passes its own bundler-mode type check can fail again under Vercel with extension and CommonJS interoperability errors. A successful Vite build alone does not verify the API. This was confirmed against the builder's public TypeScript implementation, not inferred from frontend warnings.

**How to apply:** Preserve full API and frontend type checking before producing deployable output. If changing the function entry or build pipeline, verify the emitted JavaScript can be imported by native Node and can serve health/session requests without starting a listener on import. Do not merely disable type errors or assume inherited settings reach Vercel unchanged.
