import { describe, expect, test } from '@jest/globals';
import { getTextMatchCondition } from '../search';

describe('getTextMatchCondition', () => {
  const TEXT_COLUMN = 'casts.text';

  test('single word', () => {
    expect(getTextMatchCondition('optimistic')).toBe(`${TEXT_COLUMN} ~* '\\moptimistic\\M'`);
  });

  test('quoted single word', () => {
    expect(getTextMatchCondition('"optimistic"')).toBe(`${TEXT_COLUMN} ~* '\\moptimistic\\M'`);
  });

  test('phrase without quotes', () => {
    expect(getTextMatchCondition('looking at clouds')).toBe(`${TEXT_COLUMN} ~* '\\mlooking at clouds\\M'`);
  });

  test('phrase with quotes', () => {
    expect(getTextMatchCondition('"looking at clouds"')).toBe(`${TEXT_COLUMN} ~* '\\mlooking at clouds\\M'`);
  });

  test('combination of quotes and boolean operator', () => {
    const result = getTextMatchCondition('"optimistic" -potato');
    expect(result).toBe(`${TEXT_COLUMN} ~* '\\moptimistic\\M' AND tsv @@ websearch_to_tsquery('english', '-potato')`);
  });

  test('complex query with multiple quoted phrases and operators', () => {
    const result = getTextMatchCondition('"happy days" AND "sunny skies" -rainy');
    expect(result).toBe(`${TEXT_COLUMN} ~* '\\mhappy days\\M' AND ${TEXT_COLUMN} ~* '\\msunny skies\\M' AND tsv @@ websearch_to_tsquery('english', '-rainy')`);
  });

  test('fallback to websearch_to_tsquery for other complex queries', () => {
    const result = getTextMatchCondition('complex -query with "mixed" elements');
    expect(result).toBe(`tsv @@ websearch_to_tsquery('english', 'complex -query with "mixed" elements')`);
  });
});
