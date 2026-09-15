import { Injectable } from '@nestjs/common'
import { FirebirdService } from '../firebird/firebird.service'

export interface EmpresaInfo {
  nmFantasia: string
  nmRazaoSocial: string
  dsCnpj: string
  dsInscEstadual: string
  dsEndereco: string
  dsNumero: string
  dsMunicipio: string
  dsUf: string
  dsTelefone: string
  dsEmail?: string
}

@Injectable()
export class EmpresaService {
  constructor(private readonly fb: FirebirdService) {}

  async obter(): Promise<EmpresaInfo> {
    const rows = await this.fb.query<Record<string, unknown>>(`
      SELECT FIRST 1
        NM_FANTASIA_EMPRESA, DS_RAZAO_SOCIAL_EMPRESA, DS_CNPJ_EMPRESA,
        DS_INSC_ESTADUAL_EMPRESA, DS_ENDERECO_EMPRESA, DS_NUMERO_EMPRESA,
        DS_MUNICIO_EMPRESA, DS_UF_EMPRESA, DS_TELEFONE_EMPRESA, DS_EMAIL_EMPRESA
      FROM EMPRESA
    `)
    const r = rows[0] ?? {}
    return {
      nmFantasia: String(r['nm_fantasia_empresa'] ?? '').trim(),
      nmRazaoSocial: String(r['ds_razao_social_empresa'] ?? '').trim(),
      dsCnpj: String(r['ds_cnpj_empresa'] ?? '').trim(),
      dsInscEstadual: String(r['ds_insc_estadual_empresa'] ?? '').trim(),
      dsEndereco: String(r['ds_endereco_empresa'] ?? '').trim(),
      dsNumero: String(r['ds_numero_empresa'] ?? '').trim(),
      dsMunicipio: String(r['ds_municio_empresa'] ?? '').trim(),
      dsUf: String(r['ds_uf_empresa'] ?? '').trim(),
      dsTelefone: String(r['ds_telefone_empresa'] ?? '').trim(),
      dsEmail: String(r['ds_email_empresa'] ?? '').trim() || undefined,
    }
  }
}
