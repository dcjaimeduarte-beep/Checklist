import { IsNumber, IsString, IsOptional, IsArray, ValidateNested, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class ItemPedidoDto {
  @IsNumber()
  cdProdutoErp: number

  @IsString()
  dsProduto: string

  @IsString()
  dsUnidade: string

  @IsNumber()
  @Min(0.001)
  qtItem: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  vlDesconto?: number

  @IsOptional()
  @IsString()
  dsObservacaoItem?: string
}

export class CriarPedidoDto {
  @IsOptional()
  @IsNumber()
  cdEmpresa?: number

  @IsOptional()
  @IsNumber()
  cdClienteErp?: number

  @IsString()
  nmCliente: string

  @IsOptional()
  @IsString()
  nrCpfCnpj?: string

  @IsOptional()
  @IsString()
  dsEmail?: string

  @IsOptional()
  @IsString()
  dsTelefone?: string

  @IsOptional()
  @IsNumber()
  cdCondicaoPagamento?: number

  @IsOptional()
  @IsString()
  dsCondicaoPagamento?: string

  @IsOptional()
  @IsNumber()
  qtdParcelas?: number

  @IsOptional()
  @IsString()
  dsObservacao?: string

  @IsOptional()
  @IsString()
  dsEndereco?: string

  @IsOptional()
  @IsString()
  dsCidade?: string

  @IsOptional()
  @IsString()
  dsUf?: string

  @IsOptional()
  @IsString()
  dsCep?: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoDto)
  itens: ItemPedidoDto[]
}
