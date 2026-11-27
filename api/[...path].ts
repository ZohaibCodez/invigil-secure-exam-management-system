// Vercel serverless adapter. Express owns /api/* exactly as in development.
// Do not import index.ts here: a serverless function must not call listen().
import app from "../artifacts/api-server/src/app";
export default app;
