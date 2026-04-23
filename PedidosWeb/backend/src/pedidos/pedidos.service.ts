import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import { FirebirdService } from '../firebird/firebird.service'
import type { CriarPedidoDto } from './dto/criar-pedido.dto'

type R = Record<string, unknown>

function fmtDate(v: unknown): string | undefined {
  if (!v) return undefined
  if (v instanceof Date) return v.toISOString().split('T')[0]
  return String(v)
}

// TLOGICO: 'T' = verdadeiro, 'F' = falso
function tLogico(v: unknown): 'S' | 'N' {
  return v === 'T' ? 'S' : 'N'
}

function mapSummary(r: R) {
  return {
    idPedidoWeb:         Number(r['cd_web_pedido']),
    nmCliente:           String(r['nm_cliente'] ?? '').trim(),
    nrCpfCnpj:          String(r['nr_cpf_cnpj'] ?? '').trim() || undefined,
    dtPedido:            fmtDate(r['dt_pedido']) ?? '',
    statusPedido:        String(r['ds_status_pedido'] ?? 'RASCUNHO'),
    vlTotal:             Number(r['vl_total'] ?? 0),
    dsCondicaoPagamento: String(r['ds_condicao_pag'] ?? '').trim() || undefined,
    stIntegradoErp:      tLogico(r['ck_integrado_erp']),
    cdPreVendaErp:       r['cd_pre_venda'] ? Number(r['cd_pre_venda']) : undefined,
    nmUsuarioWeb:        String(r['nm_usuario_web'] ?? '').trim() || undefined,
  }
}

function mapDetalhe(r: R) {
  return {
    idPedidoWeb:         Number(r['cd_web_pedido']),
    cdEmpresa:           Number(r['cd_empresa'] ?? 1),
    cdFilial:            r['cd_filial']   ? Number(r['cd_filial'])  : undefined,
    cdClienteErp:        r['cd_cliente']  ? Number(r['cd_cliente']) : undefined,
    nmCliente:           String(r['nm_cliente'] ?? '').trim(),
    nrCpfCnpj:          String(r['nr_cpf_cnpj'] ?? '').trim() || undefined,
    dsEmail:             String(r['ds_email'] ?? '').trim() || undefined,
    dsTelefone:          String(r['ds_telefone'] ?? '').trim() || undefined,
    dtPedido:            fmtDate(r['dt_pedido']) ?? '',
    statusPedido:        String(r['ds_status_pedido'] ?? 'RASCUNHO'),
    vlSubtotal:          Number(r['vl_subtotal'] ?? 0),
    vlDesconto:          Number(r['vl_desconto'] ?? 0),
    vlAcrescimo:         Number(r['vl_acrescimo'] ?? 0),
    vlFrete:             Number(r['vl_frete'] ?? 0),
    vlTotal:             Number(r['vl_total'] ?? 0),
    cdCondicaoPagamento: r['cd_condicao_pag'] ? Number(r['cd_condicao_pag']) : undefined,
    dsCondicaoPagamento: String(r['ds_condicao_pag'] ?? '').trim() || undefined,
    qtdParcelas:         r['qt_parcelas'] ? Number(r['qt_parcelas']) : undefined,
    dsObservacao:        String(r['ds_observacao'] ?? '').trim() || undefined,
    dsEndereco:          String(r['ds_endereco'] ?? '').trim() || undefined,
    dsCidade:            String(r['ds_cidade'] ?? '').trim() || undefined,
    dsUf:                String(r['ds_uf'] ?? '').trim() || undefined,
    dsCep:               String(r['ds_cep'] ?? '').trim() || undefined,
    nmUsuarioWeb:        String(r['nm_usuario_web'] ?? '').trim() || undefined,
    cdPreVendaErp:       r['cd_pre_venda'] ? Number(r['cd_pre_venda']) : undefined,
    cdSaidaErp:          r['cd_saida']     ? Number(r['cd_saida'])     : undefined,
    stIntegradoErp:      tLogico(r['ck_integrado_erp']),
    dtIntegracaoErp:     fmtDate(r['dt_integracao_erp']),
    dtCadastro:          fmtDate(r['dt_cadastro']) ?? '',
    dt1Vencimento:       fmtDate(r['dt_1_vencimento']),
    vlParcelas:          r['vl_parcelas'] ? Number(r['vl_parcelas']) : undefined,
    vlEntrada:           r['vl_entrada']  ? Number(r['vl_entrada'])  : undefined,
    stPgtoConfirmado:    r['ck_confirmado'] ? tLogico(r['ck_confirmado']) : undefined,
  }
}

function mapItem(r: R) {
  return {
    idItem:       Number(r['nr_sequencial']),
    cdProdutoErp: Number(r['cd_produto']),
    dsProduto:    String(r['ds_produto'] ?? '').trim(),
    dsUnidade:    String(r['ds_unidade'] ?? '').trim(),
    qtItem:       Number(r['qt_item'] ?? 0),
    vlUnitario:   Number(r['vl_unitario'] ?? 0),
    vlDesconto:   Number(r['vl_desconto'] ?? 0),
    vlAcrescimo:  Number(r['vl_acrescimo'] ?? 0),
    vlTotalItem:  Number(r['vl_total_item'] ?? 0),
  }
}

function mapHistorico(r: R) {
  return {
    idHist:          Number(r['cd_web_pedido_hist']),
    dtEvento:        fmtDate(r['dt_evento']) ?? '',
    statusAnterior:  String(r['ds_status_anterior'] ?? ''),
    statusNovo:      String(r['ds_status_novo'] ?? ''),
    tipoEvento:      String(r['ds_tipo_evento'] ?? ''),
    dsEvento:        String(r['ds_evento'] ?? ''),
    nmUsuario:       String(r['nm_usuario_web'] ?? ''),
  }
}

@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name)

  constructor(private readonly fb: FirebirdService) {}

  async listar(status?: string): Promise<unknown[]> {
    const where = status ? `WHERE p.DS_STATUS_PEDIDO = '${status.replace(/'/g, '')}'` : ''
    const rows = await this.fb.query<R>(`
      SELECT FIRST 100
        p.CD_WEB_PEDIDO, p.NM_CLIENTE, p.NR_CPF_CNPJ, p.DT_PEDIDO,
        p.DS_STATUS_PEDIDO, p.VL_TOTAL, p.DS_CONDICAO_PAG,
        p.CK_INTEGRADO_ERP, p.CD_PRE_VENDA, p.NM_USUARIO_WEB
      FROM WEB_PEDIDOS p
      ${where}
      ORDER BY p.DT_PEDIDO DESC, p.CD_WEB_PEDIDO DESC
    `)
    return rows.map(mapSummary)
  }

  async obter(id: number): Promise<unknown> {
    const rows = await this.fb.query<R>(`
      SELECT
        p.CD_WEB_PEDIDO, p.CD_EMPRESA, p.CD_FILIAL, p.CD_CLIENTE,
        p.NM_CLIENTE, p.NR_CPF_CNPJ, p.DS_EMAIL, p.DS_TELEFONE,
        p.DT_PEDIDO, p.DS_STATUS_PEDIDO,
        p.VL_SUBTOTAL, p.VL_DESCONTO, p.VL_ACRESCIMO, p.VL_FRETE, p.VL_TOTAL,
        p.CD_CONDICAO_PAG, p.DS_CONDICAO_PAG, p.QT_PARCELAS,
        p.DS_OBSERVACAO, p.DS_ENDERECO, p.DS_CIDADE, p.DS_UF, p.DS_CEP,
        p.NM_USUARIO_WEB, p.CD_PRE_VENDA, p.CD_SAIDA,
        p.CK_INTEGRADO_ERP, p.DT_INTEGRACAO_ERP, p.DT_CADASTRO,
        pg.DT_1_VENCIMENTO, pg.VL_PARCELAS, pg.VL_ENTRADA,
        pg.CK_CONFIRMADO
      FROM WEB_PEDIDOS p
      LEFT JOIN WEB_PEDIDOS_PAGAMENTO pg ON pg.CD_WEB_PEDIDO = p.CD_WEB_PEDIDO
                                        AND pg.CD_EMPRESA    = p.CD_EMPRESA
      WHERE p.CD_WEB_PEDIDO = ?
    `, [id])

    if (!rows.length) throw new NotFoundException(`Pedido #${id} não encontrado`)

    const pedido = mapDetalhe(rows[0])

    const itensRaw = await this.fb.query<R>(`
      SELECT CD_WEB_PEDIDO_ITEM, NR_SEQUENCIAL, CD_PRODUTO, DS_PRODUTO, DS_UNIDADE,
             QT_ITEM, VL_UNITARIO, VL_DESCONTO, VL_ACRESCIMO, VL_TOTAL_ITEM
      FROM WEB_PEDIDOS_ITENS
      WHERE CD_WEB_PEDIDO = ?
      ORDER BY NR_SEQUENCIAL
    `, [id])

    const histRaw = await this.fb.query<R>(`
      SELECT CD_WEB_PEDIDO_HIST, DT_EVENTO, DS_STATUS_ANTERIOR, DS_STATUS_NOVO,
             DS_TIPO_EVENTO, DS_EVENTO, NM_USUARIO_WEB
      FROM WEB_PEDIDOS_HISTORICO
      WHERE CD_WEB_PEDIDO = ?
      ORDER BY DT_EVENTO DESC, CD_WEB_PEDIDO_HIST DESC
    `, [id])

    return {
      ...pedido,
      itens: itensRaw.map(mapItem),
      pagamentos: [],
      historico: histRaw.map(mapHistorico),
    }
  }

  async criar(dto: CriarPedidoDto, usuarioWeb: string): Promise<unknown> {
    // Buscar preços reais do ERP — nunca aceitar do frontend
    const produtosErp = await Promise.all(
      dto.itens.map((item) =>
        this.fb.query<R>(
          'SELECT VL_PRECO_VENDA, DS_DESCRICAO_PRODUTO, DS_UNIDADE_PRODUTO FROM PRODUTOS WHERE CD_PRODUTO = ?',
          [item.cdProdutoErp],
        ).then((rows) => rows[0] ?? {}),
      ),
    )

    let vlSubtotal = 0
    let vlDesconto = 0
    const itensCalc = dto.itens.map((itemDto, idx) => {
      const p = produtosErp[idx]
      const vlUnitario = Number(p['vl_preco_venda'] ?? 0)
      const qt   = itemDto.qtItem
      const desc = itemDto.vlDesconto ?? 0
      vlSubtotal += qt * vlUnitario
      vlDesconto += desc
      return {
        ...itemDto,
        vlUnitario,
        dsProduto: String(p['ds_descricao_produto'] ?? itemDto.dsProduto).trim(),
        dsUnidade: String(p['ds_unidade_produto']   ?? itemDto.dsUnidade).trim(),
        vlTotalItem: qt * vlUnitario - desc,
      }
    })

    const vlTotal = vlSubtotal - vlDesconto

    const [idRow] = await this.fb.query<R>(
      'SELECT GEN_ID(GEN_WEB_PEDIDOS, 1) AS NOVO_ID FROM RDB$DATABASE',
    )
    const novoId = Number(idRow?.['novo_id'])
    const dtPedido = new Date().toISOString().split('T')[0]

    await this.fb.execute(`
      INSERT INTO WEB_PEDIDOS (
        CD_WEB_PEDIDO, CD_EMPRESA, CD_CLIENTE, NM_CLIENTE, NR_CPF_CNPJ,
        DS_EMAIL, DS_TELEFONE, DT_PEDIDO, DS_STATUS_PEDIDO,
        VL_SUBTOTAL, VL_DESCONTO, VL_ACRESCIMO, VL_FRETE, VL_TOTAL,
        CD_CONDICAO_PAG, DS_CONDICAO_PAG, QT_PARCELAS,
        DS_OBSERVACAO, DS_ENDERECO, DS_CIDADE, DS_UF, DS_CEP,
        NM_USUARIO_WEB, CK_INTEGRADO_ERP, DT_CADASTRO
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, 'RASCUNHO',
        ?, ?, 0, 0, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, 'F', CURRENT_TIMESTAMP
      )
    `, [
      novoId, dto.cdEmpresa ?? 1, dto.cdClienteErp ?? null,
      dto.nmCliente, dto.nrCpfCnpj ?? null,
      dto.dsEmail ?? null, dto.dsTelefone ?? null, dtPedido,
      vlSubtotal, vlDesconto, vlTotal,
      dto.cdCondicaoPagamento ?? null, dto.dsCondicaoPagamento ?? null, dto.qtdParcelas ?? null,
      dto.dsObservacao ?? null, dto.dsEndereco ?? null,
      dto.dsCidade ?? null, dto.dsUf ?? null, dto.dsCep ?? null,
      usuarioWeb,
    ])

    for (let idx = 0; idx < itensCalc.length; idx++) {
      const item = itensCalc[idx]
      const [itemIdRow] = await this.fb.query<R>(
        'SELECT GEN_ID(GEN_WEB_PEDIDOS_ITEM, 1) AS NOVO_ID FROM RDB$DATABASE',
      )
      const itemId = Number(itemIdRow?.['novo_id'])

      await this.fb.execute(`
        INSERT INTO WEB_PEDIDOS_ITENS (
          CD_WEB_PEDIDO_ITEM, CD_EMPRESA, CD_WEB_PEDIDO,
          NR_SEQUENCIAL, CD_PRODUTO, DS_PRODUTO, DS_UNIDADE,
          QT_ITEM, VL_UNITARIO, VL_DESCONTO, VL_ACRESCIMO, VL_TOTAL_ITEM
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `, [
        itemId, dto.cdEmpresa ?? 1, novoId,
        idx + 1, item.cdProdutoErp, item.dsProduto, item.dsUnidade,
        item.qtItem, item.vlUnitario, item.vlDesconto ?? 0, item.vlTotalItem,
      ])
    }

    if (dto.cdCondicaoPagamento) {
      const [fpRow] = await this.fb.query<R>(
        'SELECT CD_INTERVALO_DIAS_PRI_PARC FROM FORMA_PAGAMENTO WHERE CD_FORMA_PAGAMENTO = ?',
        [dto.cdCondicaoPagamento],
      )
      const intervalDias = fpRow?.['cd_intervalo_dias_pri_parc']
        ? Number(fpRow['cd_intervalo_dias_pri_parc'])
        : 0
      const dtVenc = new Date()
      dtVenc.setDate(dtVenc.getDate() + intervalDias)
      const dt1Vencimento = dtVenc.toISOString().split('T')[0]
      const qtParcelas = dto.qtdParcelas ?? 1
      const vlParcela  = qtParcelas > 1
        ? Math.round((vlTotal / qtParcelas) * 100) / 100
        : vlTotal

      const [pagIdRow] = await this.fb.query<R>(
        'SELECT GEN_ID(GEN_WEB_PEDIDOS_PAG, 1) AS NOVO_ID FROM RDB$DATABASE',
      )
      const pagId = Number(pagIdRow?.['novo_id'])

      await this.fb.execute(`
        INSERT INTO WEB_PEDIDOS_PAGAMENTO (
          CD_WEB_PEDIDO_PAG, CD_EMPRESA, CD_WEB_PEDIDO,
          CD_CONDICAO_PAG, DS_CONDICAO_PAG,
          QT_PARCELAS, VL_ENTRADA, VL_PARCELAS, DT_1_VENCIMENTO,
          DS_OBSERVACAO, CK_CONFIRMADO, DT_CADASTRO
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'Pagamento informado via pedido web', 'F', CURRENT_TIMESTAMP)
      `, [
        pagId, dto.cdEmpresa ?? 1, novoId,
        dto.cdCondicaoPagamento, dto.dsCondicaoPagamento ?? '',
        qtParcelas, vlParcela, dt1Vencimento,
      ])
    }

    await this.registrarHistorico(
      novoId, dto.cdEmpresa ?? 1,
      '', 'RASCUNHO', 'CRIACAO', 'Pedido criado via web', usuarioWeb,
    )
    return this.obter(novoId)
  }

  async transmitir(id: number, usuarioWeb: string): Promise<unknown> {
    const detalhe = await this.obter(id) as R
    const status  = String(detalhe['statusPedido'])

    if (!['RASCUNHO', 'PENDENTE', 'ERRO'].includes(status)) {
      throw new BadRequestException(`Pedido com status "${status}" não pode ser transmitido`)
    }

    const cdEmpresa = Number(detalhe['cdEmpresa'] ?? 1)

    await this.fb.execute(
      `UPDATE WEB_PEDIDOS SET DS_STATUS_PEDIDO = 'TRANSMITINDO', DT_ENVIO_ERP = CURRENT_TIMESTAMP
       WHERE CD_WEB_PEDIDO = ?`,
      [id],
    )
    await this.registrarHistorico(
      id, cdEmpresa, status, 'TRANSMITINDO', 'TRANSMISSAO', 'Iniciando transmissão ao ERP', usuarioWeb,
    )

    try {
      const [maxPv] = await this.fb.query<R>('SELECT MAX(CD_PRE_VENDA) AS MAX_ID FROM PRE_VENDA')
      const cdPreVenda = (Number(maxPv?.['max_id'] ?? 0)) + 1

      const itens   = (detalhe['itens'] as R[]) ?? []
      const dtVenda = new Date().toISOString().split('T')[0]

      await this.fb.execute(
        `INSERT INTO PRE_VENDA (CD_PRE_VENDA, CD_EMPRESA, DS_CODIGO_CLIENTE, DT_VENDA, DS_TIPO_VENDA, VL_TOTAL, DS_CODIGO_LOJA)
         VALUES (?, ?, ?, ?, 'V', ?, '1')`,
        [cdPreVenda, cdEmpresa, String(detalhe['cdClienteErp'] ?? ''), dtVenda, detalhe['vlTotal']],
      )

      for (let i = 0; i < itens.length; i++) {
        const item = itens[i]
        await this.fb.execute(
          `INSERT INTO PRE_VENDA_PRODUTOS (CD_PRE_VENDA_PROD, CD_EMPRESA_PROD, CD_SEQUENCIAL, CD_PRODUTO, VL_QTD_PRODUTO, VL_UNT_PRODUTO)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [cdPreVenda, cdEmpresa, i + 1, item['cdProdutoErp'], item['qtItem'], item['vlUnitario']],
        )
      }

      await this.fb.execute(`
        UPDATE WEB_PEDIDOS SET
          DS_STATUS_PEDIDO = 'CONFIRMADO', CK_INTEGRADO_ERP = 'T',
          CD_PRE_VENDA = ?, DT_INTEGRACAO_ERP = CURRENT_TIMESTAMP,
          DT_ULT_ALTERACAO = CURRENT_TIMESTAMP
        WHERE CD_WEB_PEDIDO = ?
      `, [cdPreVenda, id])

      await this.fb.execute(
        `UPDATE WEB_PEDIDOS_PAGAMENTO SET CK_CONFIRMADO = 'T' WHERE CD_WEB_PEDIDO = ?`,
        [id],
      )

      await this.registrarHistorico(
        id, cdEmpresa, 'TRANSMITINDO', 'CONFIRMADO',
        'CONFIRMACAO', `Pré-Venda #${cdPreVenda} gerada no ERP`, usuarioWeb,
      )
      this.logger.log(`Pedido #${id} → Pré-Venda #${cdPreVenda}`)

    } catch (err) {
      await this.fb.execute(
        `UPDATE WEB_PEDIDOS SET DS_STATUS_PEDIDO = 'ERRO', DT_ULT_ALTERACAO = CURRENT_TIMESTAMP
         WHERE CD_WEB_PEDIDO = ?`,
        [id],
      )
      await this.registrarHistorico(id, cdEmpresa, 'TRANSMITINDO', 'ERRO', 'ERRO', 'Falha na transmissão', usuarioWeb)
      throw err
    }

    return this.obter(id)
  }

  async finalizar(id: number, usuarioWeb: string): Promise<unknown> {
    const detalhe = await this.obter(id) as R
    const status  = String(detalhe['statusPedido'])

    if (status !== 'RASCUNHO') {
      throw new BadRequestException(`Apenas pedidos em RASCUNHO podem ser finalizados (atual: ${status})`)
    }

    const cdEmpresa = Number(detalhe['cdEmpresa'] ?? 1)
    await this.fb.execute(
      `UPDATE WEB_PEDIDOS SET DS_STATUS_PEDIDO = 'PENDENTE', DT_ULT_ALTERACAO = CURRENT_TIMESTAMP
       WHERE CD_WEB_PEDIDO = ?`,
      [id],
    )
    await this.registrarHistorico(
      id, cdEmpresa, 'RASCUNHO', 'PENDENTE',
      'FINALIZACAO', 'Pedido finalizado — aguardando envio ao ERP', usuarioWeb,
    )
    return this.obter(id)
  }

  async cancelar(id: number, usuarioWeb: string, motivo?: string): Promise<void> {
    const detalhe = await this.obter(id) as R
    const status  = String(detalhe['statusPedido'])

    if (!['RASCUNHO', 'PENDENTE', 'ERRO', 'CONFIRMADO'].includes(status)) {
      throw new BadRequestException(`Pedido com status "${status}" não pode ser cancelado`)
    }

    const cdEmpresa = Number(detalhe['cdEmpresa'] ?? 1)
    await this.fb.execute(
      `UPDATE WEB_PEDIDOS SET DS_STATUS_PEDIDO = 'CANCELADO', DT_ULT_ALTERACAO = CURRENT_TIMESTAMP
       WHERE CD_WEB_PEDIDO = ?`,
      [id],
    )
    const dsEvento = motivo ? `Cancelado: ${motivo}` : 'Cancelado pelo usuário'
    await this.registrarHistorico(id, cdEmpresa, status, 'CANCELADO', 'CANCELAMENTO', dsEvento, usuarioWeb)
  }

  private async registrarHistorico(
    idPedido: number, cdEmpresa: number,
    statusAnterior: string, statusNovo: string,
    tipoEvento: string, dsEvento: string, nmUsuario: string,
  ): Promise<void> {
    try {
      const [idRow] = await this.fb.query<R>(
        'SELECT GEN_ID(GEN_WEB_PEDIDOS_HIST, 1) AS NOVO_ID FROM RDB$DATABASE',
      )
      const novoId = Number(idRow?.['novo_id'])
      await this.fb.execute(`
        INSERT INTO WEB_PEDIDOS_HISTORICO (
          CD_WEB_PEDIDO_HIST, CD_EMPRESA, CD_WEB_PEDIDO,
          DT_EVENTO, HR_EVENTO,
          DS_STATUS_ANTERIOR, DS_STATUS_NOVO,
          DS_TIPO_EVENTO, DS_EVENTO, NM_USUARIO_WEB
        ) VALUES (?, ?, ?, CURRENT_DATE, CURRENT_TIME, ?, ?, ?, ?, ?)
      `, [novoId, cdEmpresa, idPedido, statusAnterior, statusNovo, tipoEvento, dsEvento, nmUsuario])
    } catch (err) {
      this.logger.warn(`Falha ao registrar histórico do pedido ${idPedido}: ${(err as Error).message}`)
    }
  }
}
