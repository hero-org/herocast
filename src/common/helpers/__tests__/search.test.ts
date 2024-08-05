import { describe, expect, test } from '@jest/globals';
import { getTextMatchCondition } from '../search';

describe('getTextMatchCondition', () => {
  const TEXT_COLUMN = 'casts.text';

  test('single word', () => {
    expect(getTextMatchCondition('optimistic')).toBe(`${TEXT_COLUMN} ~* 'optimistic'`);
  });

  test('quoted single word', () => {
    expect(getTextMatchCondition('"optimistic"')).toBe(`${TEXT_COLUMN} ~* 'optimistic'`);
  });

  test('phrase without quotes', () => {
    expect(getTextMatchCondition('looking at clouds')).toBe(`${TEXT_COLUMN} ~* 'looking at clouds'`);
  });

  test('phrase with quotes', () => {
    expect(getTextMatchCondition('"looking at clouds"')).toBe(`${TEXT_COLUMN} ~* 'looking at clouds'`);
  });

  test('combination of quotes and boolean operator', () => {
    const result = getTextMatchCondition('"optimistic" -potato');
    expect(result).toBe(`${TEXT_COLUMN} ~* 'optimistic' AND tsv @@ websearch_to_tsquery('english', '-potato')`);
  });

  test('complex query with AND operator', () => {
    const result = getTextMatchCondition('"happy days" AND sunshine');
    expect(result).toBe(`${TEXT_COLUMN} ~* 'happy days' AND tsv @@ websearch_to_tsquery('english', 'sunshine')`);
  });

  test('complex query with multiple quoted phrases and operators', () => {
    const query = '"happy days" AND "sunny skies" -rainy';
    const result = getTextMatchCondition(query);
    expect(result).toBe(`${TEXT_COLUMN} ~* 'happy days' AND ${TEXT_COLUMN} ~* 'sunny skies' AND tsv @@ websearch_to_tsquery('english', '-rainy')`);
  });

  test('complex query with OR operator', () => {
    const result = getTextMatchCondition('"happy days" OR sunshine');
    expect(result).toBe(`${TEXT_COLUMN} ~* 'happy days' OR tsv @@ websearch_to_tsquery('english', 'sunshine')`);
  });

  test('complex query with mixed elements', () => {
    const query = 'complex -query with "mixed elements"';
    const result = getTextMatchCondition(query);
    expect(result).toBe(`tsv @@ websearch_to_tsquery('english', 'complex') AND tsv @@ websearch_to_tsquery('english', '-query') AND tsv @@ websearch_to_tsquery('english', 'with') AND ${TEXT_COLUMN} ~* 'mixed elements'`);
  });

  test('word followed by negated word without boolean operator', () => {
    const query = 'apple -banana';
    const result = getTextMatchCondition(query);
    expect(result).toBe(`tsv @@ websearch_to_tsquery('english', 'apple') AND tsv @@ websearch_to_tsquery('english', '-banana')`);
  });
});
