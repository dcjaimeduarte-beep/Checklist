import { Request, Response, NextFunction } from "express";
import { getTemplate, saveTemplate, DEFAULT_ASSUNTO, DEFAULT_CORPO } from "../config/email.template";
import { z } from "zod";

const templateSchema = z.object({
  assunto: z.string().min(1).max(300),
  corpo:   z.string().min(1).max(2000),
});

export function buscarTemplate(_req: Request, res: Response, next: NextFunction): void {
  try {
    const tpl = getTemplate();
    res.json({ ...tpl, defaults: { assunto: DEFAULT_ASSUNTO, corpo: DEFAULT_CORPO } });
  } catch (err) { next(err); }
}

export function salvarTemplate(req: Request, res: Response, next: NextFunction): void {
  try {
    const { assunto, corpo } = templateSchema.parse(req.body);
    saveTemplate(assunto, corpo);
    res.json({ ok: true });
  } catch (err) { next(err); }
}
