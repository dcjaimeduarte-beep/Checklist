import { Injectable } from '@nestjs/common'
import { FirebirdService } from '../firebird/firebird.service'

export interface CondicaoPagamento {
  cdCondicao: number
  dsCondicao: string
  qtdParcelas: number
  cdTipoDocumento: number
  dsTipoDocumento: string
  permiteParcelar: boolean
}

@Injectable()
export class CondicoesService {
  constructor(private readonly fb: FirebirdService) {}

  async listar(): Promise<CondicaoPagamento[]> {
    const rows = await this.fb.query<Record<string, unknown>>(`
      SELECT
        fp.CD_FORMA_PAGAMENTO,
        fp.DS_FORMA_PAGAMENTO,
        fp.CD_TIPO_DOCUMENTO,
        td.DS_TIPO_DOCUMENTO,
        fp.CK_PERMITE_PARCELAR,
        fp.QT_PARCELAS
      FROM FORMA_PAGAMENTO fp
      LEFT JOIN TIPO_DOCUMENTO td ON td.CD_TIPO_DOCUMENTO = fp.CD_TIPO_DOCUMENTO
      WHERE fp.CK_ATIVO = 'T'
      ORDER BY fp.DS_FORMA_PAGAMENTO
    `)

    return rows.map((r) => ({
      cdCondicao: Number(r['cd_forma_pagamento']),
      dsCondicao: String(r['ds_forma_pagamento'] ?? '').trim(),
      cdTipoDocumento: Number(r['cd_tipo_documento'] ?? 0),
      dsTipoDocumento: String(r['ds_tipo_documento'] ?? '').trim(),
      permiteParcelar: String(r['ck_permite_parcelar'] ?? 'F') === 'T',
      qtdParcelas: r['qt_parcelas'] ? Number(r['qt_parcelas']) : 1,
    }))
  }
}
