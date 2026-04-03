import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ncm_rows')
@Index(['ncmCode'])
export class NcmRowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Pode repetir em ficheiros grandes; não usar unique global. */
  @Column({ type: 'varchar', length: 16 })
  ncmCode!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'simple-json', nullable: true })
  rawRow!: Record<string, unknown> | null;
}
