import { Router } from "express";
import multer from "multer";
import {
  enviarDocumentosCliente,
  previewEnvios,
  enviarLote,
} from "../controllers/envio.controller";
import { enviarLoteUpload } from "../controllers/upload.controller";
import { apiKeyMiddleware } from "../middlewares/apiKey.middleware";
import { validate } from "../middlewares/validate.middleware";
import { envioSchema } from "../validations/envio.validation";

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 25 * 1024 * 1024, files: 500 },
});

const router = Router();

router.use(apiKeyMiddleware);

router.get("/preview",       previewEnvios);
router.post("/cliente",      validate(envioSchema), enviarDocumentosCliente);
router.post("/lote",         enviarLote);
router.post("/lote-upload",  upload.array("arquivos"), enviarLoteUpload);

export default router;
