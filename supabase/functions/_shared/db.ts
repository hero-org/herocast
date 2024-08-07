import type { ColumnType } from "kysely";

export type ArrayType<T> = ArrayTypeImpl<T> extends (infer U)[]
  ? U[]
  : ArrayTypeImpl<T>;

export type ArrayTypeImpl<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S[], I[], U[]>
  : T[];

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Int8 = ColumnType<string, bigint | number | string, bigint | number | string>;

export type Json = JsonValue;

export type JsonArray = JsonValue[];

export type JsonObject = {
  [K in string]?: JsonValue;
};

export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export type Numeric = ColumnType<string, number | string, number | string>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Casts {
  deleted_at: Timestamp | null;
  embeds: ArrayType<Json> | null;
  fid: number;
  hash: string;
  mentions: number[] | null;
  mentions_positions: number[] | null;
  parent_cast_fid: number | null;
  parent_cast_hash: string | null;
  parent_cast_url: string | null;
  text: string | null;
  timestamp: Timestamp | null;
  tsv: string | null;
}

export interface Links {
  deleted_at: Timestamp | null;
  fid: number;
  target_fid: number;
  timestamp: Timestamp | null;
  type: string;
}

export interface Powerbadge {
  created_at: Generated<Timestamp>;
  fid: number;
  updated_at: Generated<Timestamp>;
}

export interface Reactions {
  deleted_at: Timestamp | null;
  fid: number;
  target_cast_fid: number;
  target_cast_hash: string;
  timestamp: Timestamp | null;
  type: string;
}

export interface Database {
  casts: Casts;
  links: Links;
  powerbadge: Powerbadge;
  reactions: Reactions;
}
