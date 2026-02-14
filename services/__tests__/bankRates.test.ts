import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicBankRates } from '../bankRates';

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

describe('bankRates service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns rates and parsed web sources', async () => {
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify([{ name: 'Banco A', ratePesos: 35, rateUsd: 0.1 }]),
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [{ web: { title: 'Fuente A', uri: 'https://example.com/a' } }]
          }
        }
      ]
    });

    const result = await fetchPublicBankRates();

    expect(result.rates).toHaveLength(1);
    expect(result.sources).toEqual([{ title: 'Fuente A', uri: 'https://example.com/a' }]);
    expect(result.timestamp.length).toBeGreaterThan(0);
  });

  it('returns fallback values when json parsing fails', async () => {
    generateContentMock.mockResolvedValueOnce({ text: '{invalid json' });

    const result = await fetchPublicBankRates();

    expect(result.rates).toEqual([]);
    expect(result.sources).toEqual([]);
    expect(result.timestamp.length).toBeGreaterThan(0);
  });

  it('uses untitled source when title is missing', async () => {
    generateContentMock.mockResolvedValueOnce({
      text: '[]',
      candidates: [{ groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.com' } }] } }]
    });

    const result = await fetchPublicBankRates();

    expect(result.sources).toEqual([{ title: 'Fuente sin título', uri: 'https://example.com' }]);
  });
});
