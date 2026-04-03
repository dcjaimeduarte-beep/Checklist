import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('search_result_cache')
export class SearchResultCacheEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  queryKey!: string;

  @Column({ type: 'simple-json' })
  payload!: unknown;

  @Column({ type: 'datetime' })
  updatedAt!: Date;
}
