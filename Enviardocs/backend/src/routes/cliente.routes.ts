import { Router } from "express";
import {
  listarClientes,
  buscarCliente,
  buscarPorNome,
  criarCliente,
  atualizarCliente,
  desativarCliente,
  historicoEnvios,
} from "../controllers/cliente.controller";
import { apiKeyMiddleware } from "../middlewares/apiKey.middleware";

const router = Router();

router.use(apiKeyMiddleware);

router.get("/",            listarClientes);
router.get("/buscar",      buscarPorNome);
router.get("/:id",         buscarCliente);
router.get("/:id/historico", historicoEnvios);
router.post("/",           criarCliente);
router.put("/:id",         atualizarCliente);
router.delete("/:id",      desativarCliente);

export default router;
