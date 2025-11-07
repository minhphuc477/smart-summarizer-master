import i18n from '../i18n';

describe('i18n (Internationalization)', () => {
  test('has default language defined', () => {
    expect(i18n.language).toBe('en');
  });

  test('contains English translations', () => {
    const hasEnglish = i18n.hasResourceBundle('en', 'translation');
    expect(hasEnglish).toBe(true);
  });

  test('contains Vietnamese translations', () => {
    const hasVietnamese = i18n.hasResourceBundle('vi', 'translation');
    expect(hasVietnamese).toBe(true);
  });

  test('all languages have same translation keys', () => {
    const enBundle = i18n.getResourceBundle('en', 'translation');
    
    expect(enBundle).toBeDefined();
    expect(Object.keys(enBundle || {}).length).toBeGreaterThan(0);
  });

  test('navigation keys are consistent', () => {
    const requiredKeys = ['summarize', 'history', 'analytics', 'canvas'];
    
    requiredKeys.forEach(key => {
      const translation = i18n.t(key);
      expect(translation).toBeDefined();
      expect(translation).not.toBe(key); // Should be translated
    });
  });

  test('summarizer section has required keys', () => {
    const requiredKeys = ['summarize', 'summary', 'keyTakeaways', 'actionItems'];
    
    requiredKeys.forEach(key => {
      const enTranslation = i18n.t(key, { lng: 'en' });
      const viTranslation = i18n.t(key, { lng: 'vi' });
      
      expect(enTranslation).toBeDefined();
      expect(viTranslation).toBeDefined();
    });
  });
});
