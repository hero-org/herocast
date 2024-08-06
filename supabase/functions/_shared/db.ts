// import 'npm:reflect-metadata';
// import { DataSource } from 'npm:typeorm';
// import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'npm:typeorm';
import { DataSource } from "https://deno.land/x/typeorm/mod.ts";
import { Entity, PrimaryGeneratedColumn, Column } from "https://deno.land/x/typeorm/decorator/entity/Entity.ts";

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

export const getAndInitializeDataSource = async (url: string) => {
    const AppDataSource = new DataSource({
        type: 'postgres',
        url,
        synchronize: false,
        entities: [],
        logging: ["all"],
        extra: {
            ssl: {
                rejectUnauthorized: false,
            },
        },
    });

    try {
        await AppDataSource.initialize();
        console.log("Data Source has been initialized!");
        return AppDataSource;
    } catch (error) {
        console.error("Error during Data Source initialization:", error);
        throw error;
    }
};