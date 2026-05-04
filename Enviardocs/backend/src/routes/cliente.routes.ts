import { Router } from "express";
import multer from "multer";
import {
  listarClientes,
  listarClientesInativos,
  buscarCliente,
  buscarPorNome,
  criarCliente,
  atualizarCliente,
  desativarCliente,
  ativarCliente,
  historicoEnvios,
  importarClientes,
} from "../controllers/cliente.controller";
import { apiKeyMiddleware } from "../middlewares/apiKey.middleware";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|xls)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos .xlsx ou .xls são aceitos."));
    }
  },
});

router.use(apiKeyMiddleware);

router.get("/",              listarClientes);
router.get("/inativos",      listarClientesInativos);
router.get("/buscar",        buscarPorNome);
router.get("/:id",           buscarCliente);
router.get("/:id/historico", historicoEnvios);
router.post("/",             criarCliente);
router.post("/importar",     upload.single("planilha"), importarClientes);
router.put("/:id",           atualizarCliente);
router.put("/:id/ativar",    ativarCliente);
router.delete("/:id",        desativarCliente);

export default router;
