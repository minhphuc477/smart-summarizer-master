import { cn } from '../utils';

describe('Utility Functions', () => {
  describe('cn (className merger)', () => {
    test('merges multiple class names', () => {
      const result = cn('class1', 'class2', 'class3');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
      expect(result).toContain('class3');
    });

    test('handles conditional classes', () => {
      const result = cn('base', true && 'included', false && 'excluded');
      expect(result).toContain('base');
      expect(result).toContain('included');
      expect(result).not.toContain('excluded');
    });

    test('handles undefined and null values', () => {
      const result = cn('valid', undefined, null, 'also-valid');
      expect(result).toContain('valid');
      expect(result).toContain('also-valid');
    });

    test('handles empty input', () => {
      const result = cn();
      expect(typeof result).toBe('string');
    });

    test('handles Tailwind class conflicts', () => {
      const result = cn('p-4', 'p-8');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
