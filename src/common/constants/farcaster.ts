import { Embed } from "@farcaster/hub-web";

export type ParentCastIdType = {
  fid: string;
  hash: string;
}

export enum DraftStatus {
  writing = "writing",
  publishing = "publishing",
  published = "published",
}

export type DraftType = PostType & {
  status: DraftStatus,
  mentionsToFids?: { [key: string]: string }
};

export type PostType = {
  text: string;
  embeds?: Embed[];
  parentUrl?: string;
  parentCastId?: ParentCastIdType;
}

export type AuthorType = {
  fid: string,
  username: string,
  display_name?: string,
  displayName?: string,
  pfp_url?: string,
  pfp: {
    url: string
  }
}

export type EmbedType = {
  url: string,
}


export enum CastReactionType {
  likes = 'likes',
  recasts = 'recasts',
  replies = 'replies',
  links = 'links',
}

export type CastReactionsType = {
  CastReactionType?: { fid: number }[]
  recasts?: { fid: number }[]
  likes?: { fid: number }[]
  count?: number
  fids?: number[]
}

export type CastType = {
  author: AuthorType
  hash: string
  parent_author: AuthorType | { fid?: string } | null
  parentHash: string | null
  parent_hash: string | null
  parent_url: string | null
  reactions: CastReactionsType
  text: string
  thread_hash: string | null
  timestamp: string
  embeds: EmbedType[]
  replies?: { count: number }
  recasts?: { fids: number[], count: number }
}
