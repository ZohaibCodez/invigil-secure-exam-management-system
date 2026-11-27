import express, { type Express, type ErrorRequestHandler } from "express";
import pinoHttp from "pino-http";
import { toNodeHandler } from "better-auth/node";
import { ZodError } from "zod/v4";
import router from "./routes";
import { logger } from "./lib/logger";
import { auth } from "./lib/auth";
import { HttpError } from "./lib/access";

const app: Express = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.all("/api/auth/{*splat}", toNodeHandler(auth));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.origin) {
    const allowed = [
      `${req.protocol}://${req.get("host")}`,
      process.env.BETTER_AUTH_URL,
      process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined,
    ];
    if (!allowed.includes(req.headers.origin)) { res.status(403).json({ error: "Cross-origin mutation rejected." }); return; }
  }
  next();
});

app.use("/api", router);
const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: error.issues.map(i => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") }); return;
  }
  if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
  if (error?.code === "23505") { res.status(409).json({ error: "This record already exists. Refresh and try again." }); return; }
  if (error?.type === "entity.too.large") { res.status(413).json({ error: "Request exceeds the 2 MB limit." }); return; }
  req.log.error({ name: error?.name, code: error?.code }, "Request failed");
  res.status(500).json({ error: "The server could not complete the request. Please retry." });
};
app.use(errorHandler);

export default app;
