/**
 * Template do e-mail de envio de documentos.
 * Edite aqui o assunto e o corpo do e-mail.
 */

export function gerarAssunto(nomeCliente: string, mes: string): string {
  return `Documentos ${mes} — ${nomeCliente}`;
}

export function gerarCorpo(_nomeCliente: string, mes: string): string {
  return `Prezado(a),

Segue em anexo os documentos referentes ao mês de ${mes}.

Qualquer dúvida, estamos à disposição.

Atenciosamente,
Seven Sistemas de Automação
(82) 99940-2789`;
}
