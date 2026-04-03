import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('lc214_chunks')
@Index(['pageNumber', 'chunkIndex'])
export class Lc214ChunkEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'integer', default: 0 })
  pageNumber!: number;

  @Column({ type: 'integer', default: 0 })
  chunkIndex!: number;

  @Column({ type: 'text' })
  text!: string;
}
