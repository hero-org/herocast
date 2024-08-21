import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Analytics } from './entities/Analytics';

@Entity({ name: 'casts' })
export class Cast {
  @PrimaryColumn()
  fid: number;

  @Column()
  hash: string;

  @CreateDateColumn({ type: 'timestamptz' })
  timestamp: Date;

  @Column('jsonb', { array: true })
  embeds: object[];

  @Column({ nullable: true })
  parent_cast_url: string;

  @Column({ nullable: true })
  parent_cast_fid: number;

  @Column({ nullable: true })
  parent_cast_hash: string;

  @Column()
  text: string;

  @Column('int', { array: true })
  mentions: number[];

  @Column('int', { array: true })
  mentions_positions: number[];

  @UpdateDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date;

  @Column({ type: 'tsvector' })
  tsv: string;
}

@Entity({ name: 'powerbadge' })
class Powerbadge {
  @PrimaryColumn()
  fid: number;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  updated_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: false })
  updated_at: Date;
}

@Entity({ name: 'reactions' })
class Reaction {
  @PrimaryColumn()
  fid: number;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  timestamp: Date;

  @Column()
  target_cast_fid: number;

  @Column()
  target_cast_hash: string;

  @Column()
  type: string;
}

export const initializeDataSourceWithRetry = async (retries = 3) => {
  const AppDataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: false,
    entities: [Cast, Powerbadge, Reaction, Analytics],
    logging: 'all',
    extra: {
      ssl: {
        rejectUnauthorized: false,
      },
    },
  });

  while (retries) {
    try {
      const start = process.hrtime();
      await AppDataSource.initialize();
      const end = process.hrtime(start);
      const timeTaken = end[0] * 1000 + end[1] / 1e6; // Convert to milliseconds
      console.log(`Data Source has been initialized! Time taken: ${timeTaken.toFixed(2)} ms`);
      break;
    } catch (err) {
      console.error('Error during Data Source initialization:', err);
      retries -= 1;
      console.log(`Retries left: ${retries}`);
      await new Promise((res) => setTimeout(res, 5000)); // Wait 5 seconds before retrying
    }
  }

  if (!retries) {
    console.error('Failed to initialize Data Source after multiple attempts');
  }
  return AppDataSource;
};
