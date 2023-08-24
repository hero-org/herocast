export type AuthorType = {
  fid: string,
  username: string,
  display_name?: string,
  displayName?: string,
  pfp_url?: string,
  pfp?: {
    url: string,
  }
}

export type EmbedType = {
  url: string,
}


export enum CastReactionType {
  likes = 'likes',
  recasts = 'recasts',
  replies = 'replies',
}

export type CastReactionsType = {
  CastReactionType: { fid: number }[]
}

export type CastType = {
  author: AuthorType
  hash: string
  parent_author: AuthorType | { fid?: string } | null
  parent_hash: string | null
  parent_url: string | null
  reactions: CastReactionsType
  text: string
  thread_hash: string | null
  timestamp: string
  embeds: EmbedType[]
  replies: { count: number }
  source: { type: string }
}

export const VITE_NEYNAR_API_KEY = import.meta.env.VITE_NEYNAR_API_KEY
