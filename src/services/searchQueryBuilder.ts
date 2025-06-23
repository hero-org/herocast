/**
 * SearchQueryBuilder handles advanced query operators for Neynar search
 * Supports: +, |, *, "", (), ~n, -, before:, after:, from:, channel:, parent:
 */
export class SearchQueryBuilder {
  private query: string;
  private filters: {
    authorFid?: number;
    channelId?: string;
    parentUrl?: string;
    beforeDate?: string;
    afterDate?: string;
  } = {};

  constructor(query: string) {
    this.query = query || '';
    if (this.query) {
      this.parseQuery();
    }
  }

  private parseQuery(): void {
    // Extract and process special operators
    this.query = this.extractDateFilters(this.query);
    this.query = this.extractChannelFilter(this.query);
    this.query = this.extractParentFilter(this.query);
    // Note: from: filter is handled separately as it requires async profile lookup
  }

  private extractDateFilters(query: string): string {
    if (!query) return '';

    // Extract before: operator
    const beforeMatch = query.match(/before:(\d{4}-\d{2}-\d{2})/);
    if (beforeMatch) {
      this.filters.beforeDate = beforeMatch[1];
      query = query.replace(beforeMatch[0], '').trim();
    }

    // Extract after: operator
    const afterMatch = query.match(/after:(\d{4}-\d{2}-\d{2})/);
    if (afterMatch) {
      this.filters.afterDate = afterMatch[1];
      query = query.replace(afterMatch[0], '').trim();
    }

    return query;
  }

  private extractChannelFilter(query: string): string {
    if (!query) return '';

    const channelMatch = query.match(/channel:([^\s]+)/);
    if (channelMatch) {
      this.filters.channelId = channelMatch[1];
      query = query.replace(channelMatch[0], '').trim();
    }
    return query;
  }

  private extractParentFilter(query: string): string {
    if (!query) return '';

    const parentMatch = query.match(/parent:([^\s]+)/);
    if (parentMatch) {
      this.filters.parentUrl = parentMatch[1];
      query = query.replace(parentMatch[0], '').trim();
    }
    return query;
  }

  /**
   * Build the final query object with date filters in the query string
   */
  buildQuery(): { q: string; filters: typeof this.filters } {
    let finalQuery = this.query;

    // Re-add date filters to the query string as Neynar expects them
    if (this.filters.beforeDate) {
      finalQuery += ` before:${this.filters.beforeDate}`;
    }
    if (this.filters.afterDate) {
      finalQuery += ` after:${this.filters.afterDate}`;
    }

    // Remove channel: and parent: from query as they're passed as separate params
    finalQuery = finalQuery.replace(/channel:[^\s]+/g, '').trim();
    finalQuery = finalQuery.replace(/parent:[^\s]+/g, '').trim();

    return {
      q: finalQuery.trim(),
      filters: {
        channelId: this.filters.channelId,
        parentUrl: this.filters.parentUrl,
      },
    };
  }

  /**
   * Extract from: operator and return the username
   */
  static extractFromUsername(query: string): string | null {
    if (!query) return null;
    const fromMatch = query.match(/from:([^\s]+)/);
    return fromMatch ? fromMatch[1] : null;
  }

  /**
   * Remove from: operator from query
   */
  static removeFromOperator(query: string): string {
    if (!query) return '';
    return query.replace(/from:[^\s]+/g, '').trim();
  }

  /**
   * Validate query syntax
   */
  static validateQuery(query: string): { valid: boolean; error?: string } {
    if (!query) return { valid: true };

    // Check for balanced parentheses
    let parenCount = 0;
    for (const char of query) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) {
        return { valid: false, error: 'Unmatched closing parenthesis' };
      }
    }
    if (parenCount > 0) {
      return { valid: false, error: 'Unmatched opening parenthesis' };
    }

    // Check for balanced quotes
    const quoteCount = (query.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      return { valid: false, error: 'Unmatched quotation mark' };
    }

    // Validate date formats
    const datePattern = /(?:before|after):(\S+)/g;
    let dateMatch;
    while ((dateMatch = datePattern.exec(query)) !== null) {
      const date = dateMatch[1];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { valid: false, error: `Invalid date format: ${date}. Use YYYY-MM-DD` };
      }
    }

    return { valid: true };
  }

  /**
   * Get search help text for UI
   */
  static getSearchHelp(): string {
    return `Search operators:
• + (AND): star + wars
• | (OR): star | trek  
• * (prefix): cast*
• "" (phrase): "star wars"
• () (grouping): (star | trek) wars
• ~n (fuzzy): satr~3
• - (exclude): star -wars
• before: before:2025-04-20
• after: after:2025-04-20
• from: from:username
• channel: channel:farcaster
• parent: parent:url`;
  }
}
