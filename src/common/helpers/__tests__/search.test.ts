import { describe, expect, test } from '@jest/globals';
import { getTextMatchCondition } from '../search';

describe('getTextMatchCondition', () => {
  const TEXT_COLUMN = 'casts.text';

  test('should handle single word', () => {
    expect(getTextMatchCondition('optimistic')).toBe(`${TEXT_COLUMN} ~* '\\moptimistic'`);
  });

  test('should handle quoted single word', () => {
    expect(getTextMatchCondition('"optimistic"')).toBe(`${TEXT_COLUMN} ~* '\\moptimistic'`);
  });

  test('should handle phrase without quotes', () => {
    expect(getTextMatchCondition('looking at clouds')).toBe(`${TEXT_COLUMN} ~* '\\mlooking at clouds'`);
  });

  test('should handle phrase with quotes', () => {
    expect(getTextMatchCondition('"looking at clouds"')).toBe(`${TEXT_COLUMN} ~* '\\mlooking at clouds'`);
  });

  test('should handle combination of quotes and boolean operator', () => {
    const result = getTextMatchCondition('"optimistic" -potato');
    expect(result).toBe(`${TEXT_COLUMN} ~* '\\moptimistic' AND tsv @@ websearch_to_tsquery('english', '-potato')`);
  });

  test('should handle complex query with AND operator', () => {
    const result = getTextMatchCondition('"happy days" AND sunshine');
    expect(result).toBe(`${TEXT_COLUMN} ~* '\\mhappy days' AND tsv @@ websearch_to_tsquery('english', 'sunshine')`);
  });

  test('should handle complex query with multiple quoted phrases and operators', () => {
    const query = '"happy days" AND "sunny skies" -rainy';
    const result = getTextMatchCondition(query);
    expect(result).toBe(`${TEXT_COLUMN} ~* '\\mhappy days' AND ${TEXT_COLUMN} ~* '\\msunny skies' AND tsv @@ websearch_to_tsquery('english', '-rainy')`);
  });

  test('should handle complex query with OR operator', () => {
    const result = getTextMatchCondition('"happy days" OR sunshine');
    expect(result).toBe(`${TEXT_COLUMN} ~* '\\mhappy days' OR tsv @@ websearch_to_tsquery('english', 'sunshine')`);
  });

  test('should handle complex query with mixed elements', () => {
    const query = 'complex -query with "mixed elements"';
    const result = getTextMatchCondition(query);
    expect(result).toBe(`tsv @@ websearch_to_tsquery('english', 'complex') AND tsv @@ websearch_to_tsquery('english', '-query') AND tsv @@ websearch_to_tsquery('english', 'with') AND ${TEXT_COLUMN} ~* '\\mmixed elements'`);
  });

  test('should handle word followed by negated word without boolean operator', () => {
    const query = 'apple -banana';
    const result = getTextMatchCondition(query);
    expect(result).toBe(`tsv @@ websearch_to_tsquery('english', 'apple') AND tsv @@ websearch_to_tsquery('english', '-banana')`);
  });
});
