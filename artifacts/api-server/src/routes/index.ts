import { Router, type IRouter } from "express";
import healthRouter from "./health";
import proveRouter from "./prove";
import aspRouter from "./asp";
import exportRouter from "./export";

const router: IRouter = Router();

router.use(healthRouter);
router.use(proveRouter);
router.use(aspRouter);
router.use(exportRouter);

export default router;
