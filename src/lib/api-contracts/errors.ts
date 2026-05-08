import type { ZodIssue } from 'zod';

/**
 * Thrown when a runtime API response fails Zod schema validation.
 * Carries the URL, the Zod issues array, and a pointer to the agent leaf doc
 * so the failure is structured enough for both humans and agents to act on.
 */
export class ApiContractError extends Error {
  url: string;
  issues: ZodIssue[];
  see_also: string;

  constructor(args: { url: string; issues: ZodIssue[]; see_also?: string }) {
    super(`API contract validation failed for ${args.url}`);
    this.name = 'ApiContractError';
    this.url = args.url;
    this.issues = args.issues;
    this.see_also = args.see_also ?? 'docs/agents/api-contract-policy.md';
  }
}
