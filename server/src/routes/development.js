import { Router } from "express";
import {
  getPayoutSimulation,
  runPayoutSimulation,
  setPayoutSimulationStage,
} from "../controllers/developmentController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/groups/:groupId/payout-simulation", getPayoutSimulation);
router.post("/groups/:groupId/payout-simulation/time", setPayoutSimulationStage);
router.post("/groups/:groupId/payout-simulation/run", runPayoutSimulation);

export default router;
