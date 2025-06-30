export const commandAliases: Record<string, string> = {
  // Natural language phrases
  'new post': 'Create cast',
  'write post': 'Create cast',
  write: 'Create cast',
  compose: 'Create cast',
  'new cast': 'Create cast',
  'make post': 'Create cast',
  'post something': 'Create cast',
  'share something': 'Create cast',
  publish: 'Create cast',
  'send cast': 'Create cast',
  'post cast': 'Create cast',

  // Platform translations (Twitter/X to Farcaster)
  tweet: 'cast',
  tweets: 'casts',
  retweet: 'recast',
  'quote tweet': 'quote cast',
  dm: 'direct message',
  dms: 'direct messages',
  timeline: 'feed',
  follow: 'follow user',
  unfollow: 'unfollow user',
  like: 'react',
  favorite: 'react',
  mention: 'mention user',
  mentions: 'notifications',

  // Common typos
  serach: 'search',
  seach: 'search',
  searchh: 'search',
  srch: 'search',
  profle: 'profile',
  profiel: 'profile',
  proifle: 'profile',
  csat: 'cast',
  casr: 'cast',
  castt: 'cast',
  casy: 'cast',
  'direcr message': 'direct message',
  'dirct message': 'direct message',
  messge: 'message',
  notifcations: 'notifications',
  notifictions: 'notifications',
  notifs: 'notifications',
  settigns: 'settings',
  setings: 'settings',
  sttings: 'settings',
  channles: 'channels',
  chanels: 'channels',
  channnel: 'channel',
  recsat: 'recast',
  recats: 'recast',
  schedlue: 'schedule',
  schedul: 'schedule',
  shedule: 'schedule',
  analtyics: 'analytics',
  anlytics: 'analytics',
  analyitcs: 'analytics',
  bookmarks: 'bookmarks',
  bookmrks: 'bookmarks',
  boomarks: 'bookmarks',

  // Emoji mappings
  '📝': 'Create cast',
  '✍️': 'Create cast',
  '💬': 'Create cast',
  '🔍': 'search',
  '🔎': 'search',
  '👤': 'profile',
  '🏠': 'home',
  '🏡': 'home',
  '🔔': 'notifications',
  '📊': 'analytics',
  '📈': 'analytics',
  '⚙️': 'settings',
  '🔧': 'settings',
  '📌': 'bookmarks',
  '🔖': 'bookmarks',
  '📅': 'schedule',
  '🗓️': 'schedule',
  '👥': 'users',
  '🌐': 'channels',
  '📺': 'channels',
  '📮': 'direct message',
  '✉️': 'direct message',
  '📧': 'direct message',
  '♻️': 'recast',
  '🔄': 'recast',
  '❤️': 'react',
  '👍': 'react',
  '⭐': 'react',

  // Additional natural variations
  find: 'search',
  'look for': 'search',
  browse: 'search',
  'my profile': 'profile',
  'view profile': 'profile',
  'go to profile': 'profile',
  'open profile': 'profile',
  main: 'home',
  homepage: 'home',
  dashboard: 'home',
  feed: 'home',
  alerts: 'notifications',
  pings: 'notifications',
  messages: 'direct messages',
  inbox: 'direct messages',
  stats: 'analytics',
  insights: 'analytics',
  metrics: 'analytics',
  preferences: 'settings',
  options: 'settings',
  config: 'settings',
  configuration: 'settings',
  saved: 'bookmarks',
  saves: 'bookmarks',
  favorites: 'bookmarks',
  plan: 'schedule',
  scheduled: 'schedule',
  queue: 'schedule',
  'share again': 'recast',
  reshare: 'recast',
  boost: 'recast',
  heart: 'react',
  star: 'react',
  upvote: 'react',

  // Action variations
  'create new': 'Create cast',
  'start writing': 'Create cast',
  'open composer': 'Create cast',
  'new message': 'Create cast',
  'search for': 'search',
  'find user': 'search users',
  'find channel': 'search channels',
  'search people': 'search users',
  'search topics': 'search channels',
  'view stats': 'analytics',
  'see analytics': 'analytics',
  'check notifications': 'notifications',
  'view notifications': 'notifications',
  'open settings': 'settings',
  'change settings': 'settings',
  'manage bookmarks': 'bookmarks',
  'view bookmarks': 'bookmarks',
  'schedule post': 'schedule',
  'schedule cast': 'schedule',
  'plan post': 'schedule',

  // Shortcuts and abbreviations
  cc: 'Create cast',
  nc: 'new cast',
  dm: 'direct message',
  dms: 'direct messages',
  notis: 'notifications',
  notifs: 'notifications',
  bm: 'bookmarks',
  bms: 'bookmarks',
  sched: 'schedule',
  rc: 'recast',
  qc: 'quote cast',
  msg: 'message',
  msgs: 'messages',
  prof: 'profile',
  chan: 'channel',
  chans: 'channels',

  // Power user commands
  multi: 'multi-account',
  switch: 'switch account',
  'switch accounts': 'switch account',
  'change account': 'switch account',
  list: 'lists',
  lists: 'lists',
  'create list': 'new list',
  'make list': 'new list',
  filters: 'content filters',
  filter: 'content filters',
  mute: 'mute user',
  unmute: 'unmute user',
  block: 'block user',
  unblock: 'unblock user',
  export: 'export data',
  import: 'import data',
  backup: 'export data',
  restore: 'import data',
};

// Helper function to normalize input for matching
export const normalizeCommandInput = (input: string): string => {
  return input.toLowerCase().trim();
};

// Helper function to find command by alias
export const findCommandByAlias = (input: string): string | null => {
  const normalized = normalizeCommandInput(input);

  // Direct match
  if (commandAliases[normalized]) {
    return commandAliases[normalized];
  }

  // Partial match (input is contained in alias)
  for (const [alias, command] of Object.entries(commandAliases)) {
    if (alias.includes(normalized) || normalized.includes(alias)) {
      return command;
    }
  }

  return null;
};

// Helper function to get all aliases for a command
export const getAliasesForCommand = (command: string): string[] => {
  return Object.entries(commandAliases)
    .filter(([_, cmd]) => cmd.toLowerCase() === command.toLowerCase())
    .map(([alias]) => alias);
};
