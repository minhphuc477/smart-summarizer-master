// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
// Polyfill Fetch API types (Request, Response, Headers) for Next.js route tests
// Attempt to polyfill Web Fetch API types without adding deps
if (typeof globalThis.Headers === 'undefined') {
  class SimpleHeaders {
    constructor(init) {
      this._map = new Map();
      if (Array.isArray(init)) {
        for (const [k, v] of init) this._map.set(String(k).toLowerCase(), String(v));
      } else if (init && typeof init === 'object') {
        for (const k of Object.keys(init)) this._map.set(k.toLowerCase(), String(init[k]));
      }
    }
    append(k, v) { this._map.set(String(k).toLowerCase(), String(v)); }
    set(k, v) { this._map.set(String(k).toLowerCase(), String(v)); }
    get(k) { return this._map.get(String(k).toLowerCase()) ?? null; }
    has(k) { return this._map.has(String(k).toLowerCase()); }
  }
  globalThis.Headers = SimpleHeaders;
}

if (typeof globalThis.Request === 'undefined') {
  class SimpleRequest {
    constructor(input, init = {}) {
      this.url = typeof input === 'string' ? input : (input && input.url) || '';
      this.method = init.method || 'POST';
      this.headers = new globalThis.Headers(init.headers || {});
      this._body = init.body;
    }
    async json() { return this._body ? JSON.parse(this._body) : {}; }
    async text() { return this._body ?? ''; }
    async formData() { return new (globalThis.FormData || function() {})(); }
  }
  globalThis.Request = SimpleRequest;
}

if (typeof globalThis.Response === 'undefined') {
  class SimpleResponse {
    constructor(body, init = {}) {
      this.status = init.status || 200;
      this.headers = new globalThis.Headers(init.headers || {});
      this._body = body;
    }
    async json() { return typeof this._body === 'string' ? JSON.parse(this._body) : this._body; }
    async text() { return typeof this._body === 'string' ? this._body : JSON.stringify(this._body); }
    static json(body, init = {}) {
      const headers = Object.assign({ 'content-type': 'application/json' }, init.headers || {});
      return new SimpleResponse(JSON.stringify(body), { ...init, headers });
    }
  }
  globalThis.Response = SimpleResponse;
}

// Ensure Response.json exists even if jsdom defines Response
if (typeof globalThis.Response !== 'undefined' && typeof globalThis.Response.json !== 'function') {
  const BaseResponse = globalThis.Response;
  BaseResponse.json = function (body, init = {}) {
    const headers = Object.assign({ 'content-type': 'application/json' }, init.headers || {});
    return new BaseResponse(JSON.stringify(body), { ...init, headers });
  };
}

// Mock environment variables for testing
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.GROQ_API_KEY = 'test-groq-key'

// Mock Next.js App Router hooks globally for components using useRouter/usePathname
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock window.matchMedia (for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
}

// Polyfill scrollIntoView for components (e.g., Radix Select) in jsdom
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = jest.fn();
}

// Mock crypto.randomUUID and getRandomValues for crypto-js
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => '00000000-0000-0000-0000-000000000000',
    getRandomValues: (array) => {
      // Fill with pseudo-random values for testing
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
  },
})

// Mock Speech APIs
global.speechSynthesis = {
  speak: jest.fn(),
  cancel: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  getVoices: jest.fn(() => []),
  speaking: false,
  pending: false,
  paused: false,
}

// Mock SpeechRecognition
global.SpeechRecognition = jest.fn()
global.webkitSpeechRecognition = jest.fn()

// Mock fetch
global.fetch = jest.fn()

// Mock react-i18next for tests
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key, // Return the key itself as the translation
    i18n: {
      changeLanguage: jest.fn(),
      language: 'en',
    },
  }),
  Trans: ({ children }) => children,
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
}));

// Supabase mocking is moved to a pre-env setup file to ensure it runs before module imports

// Suppress console errors during tests (optional)
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
}
