import { describe, it, expect } from 'vitest';
import { parseOcrText } from '../lib/ocr/parser';

describe('OCR Parser', () => {
  describe('parseOcrText', () => {
    it('should extract items with unit numbers', () => {
      const text = `
MOLEK PINE Repair List
Date: 15/03/2026
A-12-03 Plumbing repair RM 450.00
B-05-11 Electrical work RM 1,200.50
      `;
      const result = parseOcrText(text);
      expect(result.items.length).toBe(2);
      expect(result.items[0].unitNo).toBe('A-12-03');
      expect(result.items[1].unitNo).toBe('B-05-11');
    });

    it('should extract amounts in RM format', () => {
      const text = 'A-12-03 Plumbing repair RM 450.00';
      const result = parseOcrText(text);
      expect(result.items[0].amount).toBe(450);
    });

    it('should extract amounts with comma separators', () => {
      const text = 'B-05-11 Electrical work RM 1,200.50';
      const result = parseOcrText(text);
      expect(result.items[0].amount).toBe(1200.5);
    });

    it('should normalize DD/MM/YYYY to YYYY-MM-DD', () => {
      const text = '15/03/2026 A-12-03 Repair RM 100.00';
      const result = parseOcrText(text);
      expect(result.items[0].date).toBe('2026-03-15');
    });

    it('should extract known project names', () => {
      const text = `
MOLEK PINE Work Order
A-12-03 Painting work RM 300.00
      `;
      const result = parseOcrText(text);
      expect(result.items[0].project).toBe('MOLEK PINE');
    });

    it('should return empty items for text without unit numbers', () => {
      const text = 'This is just a paragraph with no relevant data.';
      const result = parseOcrText(text);
      expect(result.items.length).toBe(0);
    });

    it('should assign confidence scores', () => {
      const text = '15/03/2026 MOLEK PINE A-12-03 Plumbing RM 450.00';
      const result = parseOcrText(text);
      expect(result.items[0].confidence).toBeGreaterThan(0.5);
    });

    it('should handle YYYY-MM-DD format', () => {
      const text = '2026-03-15 A-12-03 Repair RM 100.00';
      const result = parseOcrText(text);
      expect(result.items[0].date).toBe('2026-03-15');
    });

    it('should use global date when line has no date', () => {
      const text = `
Date: 15/03/2026
A-12-03 Plumbing RM 100.00
B-05-11 Electrical RM 200.00
      `;
      const result = parseOcrText(text);
      expect(result.items[0].date).toBe('2026-03-15');
      expect(result.items[1].date).toBe('2026-03-15');
    });

    it('should extract description by removing known fields', () => {
      const text = '15/03/2026 MOLEK PINE A-12-03 Plumbing leak repair RM 450.00';
      const result = parseOcrText(text);
      expect(result.items[0].description).toContain('Plumbing');
      expect(result.items[0].description).not.toContain('MOLEK PINE');
      expect(result.items[0].description).not.toContain('RM');
    });
  });
});
