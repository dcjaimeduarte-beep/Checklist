import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import { FirebirdService } from '../firebird/firebird.service'

export interface ProdutoErp {
  cdProduto: number
  dsProduto: string
  dsUnidade: string
  vlUnitario: number
  qtEstoque: number
  cdCfop?: number
  temImagem: boolean
}

const EXTS = ['.jpg', '.jpeg', '.png', '.webp']

@Injectable()
export class ProdutosService {
  constructor(private readonly fb: FirebirdService) {}

  private imagemDir(): string {
    return process.env.IMAGES_PRODUTOS_DIR ?? ''
  }

  imagemPath(cdProduto: number): string | null {
    const dir = this.imagemDir()
    if (!dir) return null
    for (const ext of EXTS) {
      const p = path.join(dir, `${cdProduto}${ext}`)
      if (fs.existsSync(p)) return p
    }
    return null
  }

  async buscar(q: string): Promise<ProdutoErp[]> {
    const termo = `%${q.toUpperCase()}%`
    const isNumerico = /^\d+$/.test(q.trim())
    const orderBy = isNumerico ? 'p.CD_PRODUTO' : 'p.DS_DESCRICAO_PRODUTO'
    // QT_ESTOQUE_ATUAL em PRODUTOS está sempre zerado no Solutio —
    // o saldo real fica em ESTOQUE_PRODUTOS.QTD_ATUAL (um registro por produto,
    // depósito "Estoque Fisico" CD_ESTOQUE=1). Fazemos LEFT JOIN para não perder
    // produtos sem movimentação ainda registrada.
    const rows = await this.fb.query<Record<string, unknown>>(`
      SELECT FIRST 20
        p.CD_PRODUTO,
        p.DS_DESCRICAO_PRODUTO,
        p.DS_UNIDADE_PRODUTO,
        p.VL_PRECO_VENDA,
        COALESCE(ep.QTD_ATUAL, 0) AS QT_ESTOQUE_ATUAL
      FROM PRODUTOS p
      LEFT JOIN ESTOQUE_PRODUTOS ep
        ON ep.CD_PRODUTO = p.CD_PRODUTO
       AND ep.CD_ESTOQUE = 1
      WHERE (
        UPPER(p.DS_DESCRICAO_PRODUTO) LIKE ?
        OR UPPER(p.DS_NUMERO_PRODUTO) LIKE ?
        OR CAST(p.CD_PRODUTO AS VARCHAR(20)) LIKE ?
      )
        AND p.VL_PRECO_VENDA > 0
        AND p.CD_SITUACAO_PRODUTO = 0
      ORDER BY ${orderBy}
    `, [termo, termo, termo])

    return rows.map((r) => {
      const cdProduto = Number(r['cd_produto'])
      return {
        cdProduto,
        dsProduto: String(r['ds_descricao_produto'] ?? '').trim(),
        dsUnidade: String(r['ds_unidade_produto'] ?? '').trim(),
        vlUnitario: Number(r['vl_preco_venda'] ?? 0),
        qtEstoque: Number(r['qt_estoque_atual'] ?? 0),
        temImagem: this.imagemPath(cdProduto) !== null,
      }
    })
  }
}
