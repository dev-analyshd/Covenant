import { Router, type IRouter } from "express";
import healthRouter from "./health";
import proveRouter from "./prove";

const router: IRouter = Router();

router.use(healthRouter);
router.use(proveRouter);

export default router;
