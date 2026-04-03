import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('web_fetch_cache')
@Index(['url'], { unique: true })
export class WebFetchCacheEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 1024 })
  url!: string;

  @Column({ type: 'text' })
  bodySnippet!: string;

  @Column({ type: 'datetime' })
  fetchedAt!: Date;
}
