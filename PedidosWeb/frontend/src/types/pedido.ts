export type PedidoStatus =
  | 'RASCUNHO'
  | 'PENDENTE'
  | 'TRANSMITINDO'
  | 'CONFIRMADO'
  | 'ERRO'
  | 'CANCELADO'

export interface ItemPedido {
  idItem: number
  cdProdutoErp: number
  dsProduto: string
  dsUnidade: string
  qtItem: number
  vlUnitario: number
  vlDesconto: number
  vlAcrescimo: number
  vlTotalItem: number
  cdCfop?: number
  dsObservacaoItem?: string
}

export interface PagamentoPedido {
  idPagamentoWeb: number
  cdCondicaoPagamento: number
  dsCondicaoPagamento: string
  qtdParcelas: number
  vlEntrada: number
  vlParcelas: number
  dt1Vencimento?: string
  dsObservacao?: string
  stConfirmado: 'S' | 'N'
}

export interface HistPedido {
  idHist: number
  dtEvento: string
  hrEvento: string
  statusAnterior: string
  statusNovo: string
  tipoEvento: string
  dsEvento: string
  nmUsuario: string
}

export interface PedidoDetalhe {
  idPedidoWeb: number
  erpId?: number
  cdEmpresa: number
  cdFilial?: number
  cdClienteErp?: number
  nmCliente: string
  nrCpfCnpj?: string
  dsEmail?: string
  dsTelefone?: string
  dtPedido: string
  hrPedido?: string
  statusPedido: PedidoStatus
  origemPedido?: string
  tipoPedido?: string
  vlSubtotal: number
  vlDesconto: number
  vlAcrescimo: number
  vlFrete: number
  vlTotal: number
  cdCondicaoPagamento?: number
  dsCondicaoPagamento?: string
  qtdParcelas?: number
  dsObservacao?: string
  dsObservacaoInterna?: string
  dsEndereco?: string
  dsNumero?: string
  dsComplemento?: string
  dsBairro?: string
  dsCidade?: string
  dsUf?: string
  dsCep?: string
  nmUsuarioWeb?: string
  cdPreVendaErp?: number
  cdSaidaErp?: number
  stIntegradoErp: 'S' | 'N'
  dtEnvioErp?: string
  dtIntegracaoErp?: string
  dtCadastro: string
  dtUltAlteracao?: string
  dt1Vencimento?: string
  vlParcelas?: number
  vlEntrada?: number
  stPgtoConfirmado?: 'S' | 'N'
  itens: ItemPedido[]
  pagamentos: PagamentoPedido[]
  historico?: HistPedido[]
}

export interface PedidoSummary {
  idPedidoWeb: number
  nmCliente: string
  nrCpfCnpj?: string
  dtPedido: string
  statusPedido: PedidoStatus
  vlTotal: number
  dsCondicaoPagamento?: string
  stIntegradoErp: 'S' | 'N'
  cdPreVendaErp?: number
  nmUsuarioWeb?: string
}

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
  inativo: 'S' | 'N'
}

export interface ProdutoErp {
  cdProduto: number
  dsProduto: string
  dsUnidade: string
  vlUnitario: number
  qtEstoque?: number
  cdCfop?: number
  temImagem?: boolean
}

export interface CondicaoPagamento {
  cdCondicao: number
  dsCondicao: string
  qtdParcelas: number
  cdTipoDocumento: number
  dsTipoDocumento: string
  permiteParcelar: boolean
}

export interface CriarPedidoDto {
  cdEmpresa: number
  cdClienteErp?: number
  nmCliente: string
  nrCpfCnpj?: string
  dsEmail?: string
  dsTelefone?: string
  tipoPedido?: string
  cdCondicaoPagamento?: number
  dsCondicaoPagamento?: string
  qtdParcelas?: number
  dsObservacao?: string
  dsEndereco?: string
  dsCidade?: string
  dsUf?: string
  dsCep?: string
  itens: {
    cdProdutoErp: number
    dsProduto: string
    dsUnidade: string
    qtItem: number
    vlDesconto?: number
    dsObservacaoItem?: string
  }[]
}
