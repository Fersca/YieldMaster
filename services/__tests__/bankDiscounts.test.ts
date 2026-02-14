import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDailyDiscounts } from '../bankDiscounts';

const generateContentMock = vi.fn();

vi.mock('@google/genai', () => ({
  Type: {
    ARRAY: 'ARRAY',
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    NUMBER: 'NUMBER'
  },
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAI() {
    return {
      models: {
        generateContent: generateContentMock
      }
    };
  })
}));

describe('bankDiscounts service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns promotions with parsed sources', async () => {
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify([
        {
          bankName: 'Banco A',
          benefits: [{ category: 'Super', description: '10% off', discount: '10%' }]
        }
      ]),
      candidates: [
        { groundingMetadata: { groundingChunks: [{ web: { title: 'Fuente', uri: 'https://example.com' } }] } }
      ]
    });

    const result = await fetchDailyDiscounts(['Banco A']);

    expect(result.promotions).toHaveLength(1);
    expect(result.sources).toEqual([{ title: 'Fuente', uri: 'https://example.com' }]);
    expect(result.timestamp.length).toBeGreaterThan(0);
  });

  it('uses fallback source title when title is missing', async () => {
    generateContentMock.mockResolvedValueOnce({
      text: '[]',
      candidates: [{ groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.com' } }] } }]
    });

    const result = await fetchDailyDiscounts(['Banco A']);

    expect(result.sources).toEqual([{ title: 'Fuente', uri: 'https://example.com' }]);
  });

  it('returns fallback empty response when parse fails', async () => {
    generateContentMock.mockResolvedValueOnce({ text: 'invalid-json' });

    const result = await fetchDailyDiscounts(['Banco A']);

    expect(result.promotions).toEqual([]);
    expect(result.sources).toEqual([]);
    expect(result.timestamp).toBe('');
  });
});
