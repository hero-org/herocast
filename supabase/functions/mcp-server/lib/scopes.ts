/**
 * MCP scope vocabulary — the single source of truth for OAuth scopes
 * exposed by the Herocast MCP server.
 */
export const MCP_SCOPES = {
  'read:accounts': 'View your connected Farcaster accounts',
  'read:casts': 'Read casts and feeds',
  'write:cast': 'Post casts on your behalf',
  'manage:lists': 'Create, update, and delete your lists',
} as const;

export type McpScope = keyof typeof MCP_SCOPES;

/**
 * Safe read-only fallback when the token carries no scope claim at all.
 * This must NEVER include a write scope.
 */
export const DEFAULT_SCOPES: McpScope[] = ['read:accounts', 'read:casts'];

export type ScopeInsufficientError = Error & {
  code: 'scope_insufficient';
  required: McpScope;
};

export function assertScope(grantedScopes: string[], required: McpScope): void {
  if (!grantedScopes.includes(required)) {
    const err = new Error(`Missing required scope: ${required}`) as ScopeInsufficientError;
    err.code = 'scope_insufficient';
    err.required = required;
    throw err;
  }
}

export function isScopeInsufficientError(err: unknown): err is ScopeInsufficientError {
  return (
    err instanceof Error &&
    (err as Partial<ScopeInsufficientError>).code === 'scope_insufficient'
  );
}
