import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionRouter from "./session";
import examRouter from "./exams";
import attemptRouter from "./attempts";
import incidentReviewRouter from "./incident-review";
import peopleRouter from "./people";
import insightsRouter from "./insights";
import reportsRouter, { publicReports } from "./reports";
import { authenticated } from "../lib/access";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sessionRouter);
router.use(publicReports);
router.use(reportsRouter);
router.use(authenticated);
router.use(examRouter);
router.use(attemptRouter);
router.use(incidentReviewRouter);
router.use(peopleRouter);
router.use(insightsRouter);

export default router;
