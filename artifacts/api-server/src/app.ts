import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,   // API-only server, no HTML served
  crossOriginEmbedderPolicy: false,
}));

// ── Logging ──────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── CORS ─────────────────────────────────────────────────────────────────────
// Allow any origin on testnet; restrict to specific domain on mainnet.
app.use(cors({ origin: true, credentials: true }));

// ── Body parsing — 100 kb limit prevents DoS via huge payloads ───────────────
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// ── Rate limiting ────────────────────────────────────────────────────────────
// Proof generation involves BN254 scalar multiplications — cost-limit it.
const proveRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 60,                    // 60 proof requests per window per IP
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many proof requests — please wait before retrying" },
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests — please slow down" },
});

// Apply tighter limit to proving endpoints, general limit to everything else.
app.use("/api/prove", proveRateLimit);
app.use("/api", generalRateLimit);

app.use("/api", router);

export default app;
