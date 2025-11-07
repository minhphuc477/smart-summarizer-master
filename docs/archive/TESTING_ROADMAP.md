# Future Testing Roadmap

## Overview
Current test suite: **28 suites, 106 tests, 36% line coverage**

This document outlines opportunities to expand test coverage beyond the current comprehensive API and component test suite.

## Components Not Yet Tested

### High Priority (Core User Flows)
1. **SummarizerApp** (`components/SummarizerApp.tsx`)
   - Main application component with rich text editor
   - Note input, summarization trigger, result display
   - Save/export flows
   - Template selection integration

2. **History** (`components/History.tsx`)
   - Note history listing and filtering
   - Search and sort functionality
   - Note selection and deletion

3. **SearchBar** (`components/SearchBar.tsx`)
   - Semantic search input
   - Search results display
   - Result selection and navigation

### Medium Priority (Feature Components)
4. **TemplateSelector** (`components/TemplateSelector.tsx`)
   - Template listing and filtering
   - Category navigation
   - Template selection

5. **EncryptionDialog** (`components/EncryptionDialog.tsx`)
   - Password input and validation
   - Encrypt/decrypt flows
   - Error handling

6. **VoiceInputButton** (`components/VoiceInputButton.tsx`)
   - Microphone activation
   - Recording state management
   - Transcription integration

### Lower Priority (UI/UX Components)
7. **LanguageSelector** (`components/LanguageSelector.tsx`)
   - Language list rendering
   - Selection handling
   - i18n integration

8. **NavigationMenu** (`components/NavigationMenu.tsx`)
   - Menu rendering
   - Navigation actions

9. **theme-toggle** (`components/theme-toggle.tsx`)
   - Dark/light mode switching

## Pages Not Yet Tested

### App Router Pages
1. **app/page.tsx** - Home page
2. **app/analytics/page.tsx** - Analytics dashboard page wrapper
3. **app/canvas/page.tsx** - Canvas list page
4. **app/canvas/[id]/page.tsx** - Canvas detail page
5. **app/share/[shareId]/page.tsx** - Public share page

## Hooks Not Yet Tested

1. **useSpeech** (`lib/useSpeech.ts`)
   - Text-to-speech functionality
   - Voice selection
   - Playback controls

2. **useVoiceInput** (`lib/useVoiceInput.ts`)
   - Voice recording
   - Audio processing
   - Transcription trigger

## API Routes Needing More Coverage

### Notes Endpoints
- `app/api/notes/route.ts` - Not yet tested
- `app/api/notes/[id]/route.ts` - Not yet tested

### Other Endpoints
- `app/api/generate-embedding/route.ts` - Not yet tested
- `app/api/summarize-url/route.ts` - Not yet tested
- `app/api/user/route.ts` - Not yet tested

## Integration Test Opportunities

### User Flows
1. **Complete Summarization Flow**
   - Enter text → Select template → Generate summary → Save → View history

2. **Workspace Management**
   - Create workspace → Create folder → Save note to folder → Navigate folders

3. **Canvas Workflow**
   - Create canvas → Add nodes → Connect nodes → Save → Reload → Export

4. **Search and Discovery**
   - Create multiple notes → Search semantically → View results → Open note

5. **Sharing Flow**
   - Create note → Make public → Generate share link → View shared note (unauthenticated)

## E2E Test Scenarios

### Critical Paths (Playwright/Cypress)
1. **New User Onboarding**
   - Guest mode → Create note → Sign up → Notes migrated

2. **Power User Workflow**
   - Sign in → Create workspace → Organize notes in folders → Use templates → Analyze in analytics

3. **Collaboration**
   - Share note publicly → Recipient views → Recipient creates own account

4. **Mobile Responsiveness**
   - Test key flows on mobile viewport

## Coverage Goals

### Short Term (Next Sprint)
- Target: **50% line coverage**
- Focus: SummarizerApp, History, SearchBar components
- Add: Notes API route tests

### Medium Term
- Target: **65% line coverage**
- Focus: All remaining components
- Add: Integration tests for key flows

### Long Term
- Target: **80% line coverage**
- Focus: Edge cases, error paths
- Add: E2E test suite with Playwright

## Test Infrastructure Improvements

1. **Test Fixtures**
   - Create reusable mock data generators
   - Standardize API response fixtures

2. **Test Utilities**
   - Custom render function with providers
   - Mock authentication helpers
   - Fake timer utilities for async operations

3. **Visual Regression**
   - Add Storybook for component documentation
   - Integrate Percy or Chromatic for visual testing

4. **Performance Testing**
   - Add benchmarks for heavy operations (embedding, summarization)
   - Memory leak detection

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- SummarizerApp.test.tsx

# Run in watch mode
npm test -- --watch

# Run only changed tests
npm test -- --onlyChanged
```

## Notes
- Mock heavy dependencies (recharts, reactflow) for performance
- Use dynamic imports for ESM-only packages
- Keep tests focused and fast (<10s total suite time per 100 tests)
- Prioritize testing user-facing functionality over internal implementation details
