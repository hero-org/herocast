import { Entity, PrimaryColumn, Column, UpdateDateColumn } from "typeorm";

@Entity({ name: "analytics" })
export class Analytics {
  @PrimaryColumn()
  fid: number;

  @Column("jsonb")
  data: any;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
