import {
  initGuestData,
  canGuestUse,
  getRemainingUsage,
  incrementGuestUsage,
  addGuestNote,
  isGuestMode
} from '../guestMode';

const STORAGE_KEY = 'smart-summarizer-guest';
const mockStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', { value: mockStorage });

describe('Guest Mode', () => {
  beforeEach(() => localStorage.clear());
  
  test('initializes correctly', () => {
    const data = initGuestData();
    expect(data.usageCount).toBe(0);
    expect(data.history).toEqual([]);
  });
  
  test('checks usage limits', () => {
    const data = initGuestData();
    data.usageCount = 3;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    expect(canGuestUse()).toBe(true);
    expect(getRemainingUsage()).toBe(2);
  });
  
  test('increments usage', () => {
    initGuestData();
    incrementGuestUsage();
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(data.usageCount).toBe(1);
  });
  
  test('adds notes', () => {
    initGuestData();
    const note = addGuestNote({
      original_notes: 'Test',
      persona: null,
      summary: 'Summary',
      takeaways: [],
      actions: []
    });
    expect(note.id).toBeDefined();
  });
  
  test('detects guest mode', () => {
    expect(isGuestMode(null)).toBe(true);
    expect(isGuestMode({ user: { id: '1' } })).toBe(false);
  });
});
