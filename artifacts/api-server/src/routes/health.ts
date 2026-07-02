import { Router, type IRouter } from "express";
import { z } from "zod";

const HealthCheckResponse = z.object({ status: z.literal("ok") });

const router: IRouter = Router();

router.get(["/healthz", "/health"], (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
