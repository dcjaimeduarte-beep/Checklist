/**
 * Template do e-mail de envio de documentos.
 * Os textos são editáveis pela tela de Configurações — ficam na tabela `config`.
 * Se não houver valor salvo, usa os textos padrão abaixo.
 */
import { getDb } from '../database/db';

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

export function formatarMes(mes: string): string {
  const [ano, m] = mes.split("-");
  const nomeMes = MESES[parseInt(m, 10) - 1] ?? mes;
  return `${nomeMes}/${ano}`;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_ASSUNTO = "Documentos {{mes}} — {{cliente}}";
export const DEFAULT_CORPO =
`Prezado(a),

Segue em anexo os documentos referentes ao mês de {{mes}}.

Qualquer dúvida, estamos à disposição.

Atenciosamente,
Seven Sistemas de Automação
(82) 99940-2789`;

// ── Leitura do banco ─────────────────────────────────────────────────────────

function getConfig(key: string, fallback: string): string {
  try {
    const row = getDb()
      .prepare<[string], { value: string }>('SELECT value FROM config WHERE key = ?')
      .get(key);
    return row?.value || fallback;
  } catch {
    return fallback;
  }
}

function aplicar(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.split(`{{${k}}}`).join(v),
    template
  );
}

// ── API pública ───────────────────────────────────────────────────────────────

export function gerarAssunto(nomeCliente: string, mes: string): string {
  const tpl = getConfig('template_assunto', DEFAULT_ASSUNTO);
  return aplicar(tpl, { mes: formatarMes(mes), cliente: nomeCliente });
}

export function gerarCorpo(_nomeCliente: string, mes: string): string {
  const tpl = getConfig('template_corpo', DEFAULT_CORPO);
  return aplicar(tpl, { mes: formatarMes(mes), cliente: _nomeCliente });
}

export function getTemplate(): { assunto: string; corpo: string } {
  return {
    assunto: getConfig('template_assunto', DEFAULT_ASSUNTO),
    corpo:   getConfig('template_corpo',   DEFAULT_CORPO),
  };
}

export function saveTemplate(assunto: string, corpo: string): void {
  const db = getDb();
  const upsert = db.prepare(
    'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  db.transaction(() => {
    upsert.run('template_assunto', assunto);
    upsert.run('template_corpo',   corpo);
  })();
}
