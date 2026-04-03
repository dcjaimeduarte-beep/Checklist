import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cclass_rows')
export class CclassTribRowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Linha da planilha cClassTrib serializada (colunas variáveis). */
  @Column({ type: 'simple-json' })
  rowData!: Record<string, unknown>;
}
