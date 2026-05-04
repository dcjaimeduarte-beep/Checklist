import { Router } from "express";
import { buscarTemplate, salvarTemplate } from "../controllers/config.controller";
import { apiKeyMiddleware } from "../middlewares/apiKey.middleware";

const router = Router();
router.use(apiKeyMiddleware);
router.get("/template",  buscarTemplate);
router.put("/template",  salvarTemplate);

export default router;
