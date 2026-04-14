import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('confront_sessions')
export class ConfrontSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  spedFilename: string;

  @Column({ nullable: true })
  spedCnpj: string;

  @Column({ nullable: true })
  spedNome: string;

  @Column({ nullable: true })
  spedDtIni: string;

  @Column({ nullable: true })
  spedDtFin: string;

  @Column({ nullable: true })
  spedUf: string;

  @Column({ default: 0 })
  totalSpedEntries: number;

  @Column({ default: 0 })
  totalXmls: number;

  @Column({ default: 0 })
  totalMatches: number;

  // JSON serializado com os itens de divergência
  @Column({ type: 'text', nullable: true })
  xmlsNotInSpedJson: string;

  @Column({ type: 'text', nullable: true })
  spedNotInXmlJson: string;

  @Column({ type: 'text', nullable: true })
  xmlsSemAutorizacaoJson: string;

  @Column({ default: 0 })
  totalSemAutorizacao: number;

  /** Filtro aplicado: 'todas' | 'proprias' | 'terceiros' */
  @Column({ type: 'text', default: 'todas' })
  filtroEmissao: string;

  /** JSON com arquivos XML que falharam no parse */
  @Column({ type: 'text', nullable: true })
  xmlErrorsJson: string;

  /** JSON com totais e resumo por CFOP (dashboard) */
  @Column({ type: 'text', nullable: true })
  dashboardJson: string;

  /** JSON com relatório de auditoria fiscal */
  @Column({ type: 'text', nullable: true })
  auditJson: string;
}
