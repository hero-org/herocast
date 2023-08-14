export type AuthorType = {
  fid: string,
  username: string,
  display_name: string,
  pfp_url: string,
}

export type EmbedType = {
  url: string,
}

export type ReactionsType = {
  likes: { fid: number }[]
  recasts: { fid: number }[]
}

export type CastType = {
  author: AuthorType
  hash: string
  parent_author: AuthorType | { fid?: string } | null
  parent_hash: string | null
  parent_url: string | null
  reactions: {}
  text: string
  thread_hash: string | null
  timestamp: string
  embeds: EmbedType[]
  replies: { count: number }
  source: { type: string }
}
