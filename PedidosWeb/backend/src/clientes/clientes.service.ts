import { Injectable } from '@nestjs/common'
import { FirebirdService } from '../firebird/firebird.service'

export interface ClienteErp {
  cdCliente: number
  nmFantasia: string
  nmRazSoc: string
  cdCgc: string
  cdFoneCliente?: string
  dsEmailCliente?: string
  dsCidade?: string
  dsUf?: string
  dsEndereco?: string
  dsNumero?: string
  dsComplemento?: string
  dsCep?: string
  inativo: string
}

@Injectable()
export class ClientesService {
  constructor(private readonly fb: FirebirdService) {}

  private mapRow(r: Record<string, unknown>): ClienteErp {
    return {
      cdCliente: Number(r['cd_cliente']),
      nmFantasia: String(r['nm_fantasia_cliente'] ?? '').trim(),
      nmRazSoc: String(r['nm_raz_soc_cliente'] ?? '').trim(),
      cdCgc: String(r['cd_cgc_cliente'] ?? '').trim(),
      cdFoneCliente: String(r['cd_fone_cliente'] ?? '').trim() || undefined,
      dsEmailCliente: String(r['ds_email_cliente'] ?? '').trim() || undefined,
      dsCidade: String(r['ds_cidade'] ?? '').trim() || undefined,
      dsUf: String(r['cd_estado'] ?? '').trim() || undefined,
      dsEndereco: String(r['ds_end_com_cliente'] ?? '').trim() || undefined,
      dsNumero: String(r['ds_numero'] ?? '').trim() || undefined,
      dsComplemento: String(r['ds_complemento'] ?? '').trim() || undefined,
      dsCep: String(r['cd_cep'] ?? '').trim() || undefined,
      inativo: String(r['inativo'] ?? 'N'),
    }
  }

  private get selectColumns() {
    return `
      c.CD_CLIENTE, c.NM_FANTASIA_CLIENTE, c.NM_RAZ_SOC_CLIENTE,
      c.CD_CGC_CLIENTE, c.CD_FONE_CLIENTE, c.DS_EMAIL_CLIENTE,
      ci.DS_CIDADE, c.CD_ESTADO, c.INATIVO,
      c.DS_END_COM_CLIENTE, c.DS_NUMERO, c.DS_COMPLEMENTO, c.CD_CEP
    `
  }

  async padrao(): Promise<ClienteErp | null> {
    const rows = await this.fb.query<Record<string, unknown>>(`
      SELECT FIRST 1 ${this.selectColumns}
      FROM CLIENTE c
      LEFT JOIN CIDADE ci ON ci.CD_CIDADE = c.CD_CIDADE
      WHERE c.INATIVO <> 'S'
        AND (UPPER(c.NM_FANTASIA_CLIENTE) LIKE '%CONSUMID%' OR c.CD_CGC_CLIENTE LIKE '000000000%')
      ORDER BY c.CD_CLIENTE
    `)
    if (!rows.length) return null
    return this.mapRow(rows[0])
  }

  async buscar(q: string): Promise<ClienteErp[]> {
    const termo = `%${q.toUpperCase()}%`
    const rows = await this.fb.query<Record<string, unknown>>(`
      SELECT FIRST 20 ${this.selectColumns}
      FROM CLIENTE c
      LEFT JOIN CIDADE ci ON ci.CD_CIDADE = c.CD_CIDADE
      WHERE c.INATIVO <> 'S'
        AND (UPPER(c.NM_FANTASIA_CLIENTE) LIKE ? OR UPPER(c.NM_RAZ_SOC_CLIENTE) LIKE ? OR c.CD_CGC_CLIENTE LIKE ?)
      ORDER BY c.NM_FANTASIA_CLIENTE
    `, [termo, termo, `%${q}%`])
    return rows.map((r) => this.mapRow(r))
  }
}
