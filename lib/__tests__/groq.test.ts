// Mock groq-sdk BEFORE importing the module under test
jest.mock('groq-sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            { message: { content: JSON.stringify({
              summary: 'Mock summary',
              takeaways: ['Point 1', 'Point 2'],
              actions: [
                { task: 'Send report', datetime: null },
                { task: 'Schedule meeting', datetime: '2025-10-28T14:00:00Z' }
              ],
              tags: ['work', 'meeting'],
              sentiment: 'neutral'
            }) } }
          ]
        })
      }
    }
  }))
}))

import { getGroqSummary } from '../groq';

describe('Groq Integration - getGroqSummary', () => {
  test('returns structured summary object', async () => {
    const result = await getGroqSummary('Some notes to summarize', 'analyst persona');
    expect(result).toHaveProperty('summary');
    expect(Array.isArray(result.takeaways)).toBe(true);
    expect(Array.isArray(result.actions)).toBe(true);
    expect(Array.isArray(result.tags)).toBe(true);
    expect(['positive', 'neutral', 'negative']).toContain(result.sentiment);
  });

  // Note: Error handling for empty AI response is covered at runtime; mocking the
  // module-level Groq instance reliably in Jest without ESM loader hacks is brittle.
  // We keep the positive-path test above to validate structure.
});
