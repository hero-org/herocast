import { describe, expect, test } from '@jest/globals';
import { searchService } from '@/services/searchService';

describe('searchService.getTextMatchCondition', () => {
  const TEXT_COLUMN = 'casts.text';

  test('should handle single word', () => {
    expect(searchService.getTextMatchCondition('optimistic')).toBe(`${TEXT_COLUMN} ~* '\\moptimistic\\M'`);
  });

  test('should handle quoted single word', () => {
    expect(searchService.getTextMatchCondition('"optimistic"')).toBe(`${TEXT_COLUMN} ~* '\\moptimistic\\M'`);
  });

  test('should handle phrase without quotes', () => {
    expect(searchService.getTextMatchCondition('looking at clouds')).toBe(
      `${TEXT_COLUMN} ~* '\\mlooking at clouds\\M'`
    );
  });

  test('should handle phrase with quotes', () => {
    expect(searchService.getTextMatchCondition('"looking at clouds"')).toBe(
      `${TEXT_COLUMN} ~* '\\mlooking at clouds\\M'`
    );
  });

  test('should handle combination of quotes and boolean operator', () => {
    const result = searchService.getTextMatchCondition('"optimistic" -potato');
    expect(result).toBe(`${TEXT_COLUMN} ~* '\\moptimistic\\M' AND tsv @@ websearch_to_tsquery('english', '-potato')`);
  });

  test('should handle complex query with AND operator', () => {
    const result = searchService.getTextMatchCondition('"happy days" AND sunshine');
    expect(result).toBe(`${TEXT_COLUMN} ~* '\\mhappy days\\M' AND tsv @@ websearch_to_tsquery('english', 'sunshine')`);
  });

  test('should handle complex query with multiple quoted phrases and operators', () => {
    const query = '"happy days" AND "sunny skies" -rainy';
    const result = searchService.getTextMatchCondition(query);
    expect(result).toBe(
      `${TEXT_COLUMN} ~* '\\mhappy days\\M' AND ${TEXT_COLUMN} ~* '\\msunny skies\\M' AND tsv @@ websearch_to_tsquery('english', '-rainy')`
    );
  });

  test('should handle complex query with OR operator', () => {
    const result = searchService.getTextMatchCondition('"happy days" OR sunshine');
    expect(result).toBe(
      `(${TEXT_COLUMN} ~* '\\mhappy days\\M') OR (tsv @@ websearch_to_tsquery('english', 'sunshine'))`
    );
  });

  test('should handle complex query with mixed elements', () => {
    const query = 'complex -query with "mixed elements"';
    const result = searchService.getTextMatchCondition(query);
    expect(result).toBe(
      `tsv @@ websearch_to_tsquery('english', 'complex') AND tsv @@ websearch_to_tsquery('english', '-query') AND tsv @@ websearch_to_tsquery('english', 'with') AND ${TEXT_COLUMN} ~* '\\mmixed elements\\M'`
    );
  });

  test('should handle word followed by negated word without boolean operator', () => {
    const query = 'apple -banana';
    const result = searchService.getTextMatchCondition(query);
    expect(result).toBe(
      `tsv @@ websearch_to_tsquery('english', 'apple') AND tsv @@ websearch_to_tsquery('english', '-banana')`
    );
  });

  test('should handle two phrases with OR operator and no quotation marks', () => {
    const query = 'happy days OR sunny skies';
    const result = searchService.getTextMatchCondition(query);
    expect(result).toBe(`(${TEXT_COLUMN} ~* '\\mhappy days\\M') OR (${TEXT_COLUMN} ~* '\\msunny skies\\M')`);
  });

  test('should handle three phrases with OR operator and no quotation marks', () => {
    const query = 'happy days OR sunny skies OR rainy nights';
    const result = searchService.getTextMatchCondition(query);
    expect(result).toBe(
      `(${TEXT_COLUMN} ~* '\\mhappy days\\M') OR (${TEXT_COLUMN} ~* '\\msunny skies\\M') OR (${TEXT_COLUMN} ~* '\\mrainy nights\\M')`
    );
  });
});
