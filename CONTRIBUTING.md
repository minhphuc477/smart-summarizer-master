# Contributing to Smart Summarizer

Thank you for your interest in contributing to Smart Summarizer! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Code Style](#code-style)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)

## Code of Conduct

Be respectful, inclusive, and professional in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/smart-summarizer.git
   cd smart-summarizer
   ```
3. **Set up upstream** remote:
   ```bash
   git remote add upstream https://github.com/minhphuc477/smart-summarizer.git
   ```

## Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your Supabase and GROQ credentials.

3. **Run database migrations:**
   Follow [docs/guides/MIGRATION_INSTRUCTIONS.md](./docs/guides/MIGRATION_INSTRUCTIONS.md)

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## Making Changes

### Branch Strategy

- `master` - Production-ready code
- Feature branches - `feature/your-feature-name`
- Bug fixes - `fix/issue-description`

### Creating a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add PDF export functionality
fix: resolve authentication loop issue
docs: update API documentation
style: format code with prettier
refactor: simplify folder structure
test: add tests for canvas editor
chore: update dependencies
```

## Code Style

### TypeScript

- Use TypeScript strict mode
- Define proper interfaces and types
- Avoid `any` types when possible
- Use meaningful variable names

### React Components

- Use functional components with hooks
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Use proper prop types

### File Structure

```
components/
├── ComponentName.tsx          # Component implementation
├── __tests__/
│   └── ComponentName.test.tsx # Component tests
└── ui/                        # Shared UI components (shadcn/ui)

app/
├── api/
│   └── endpoint/
│       ├── route.ts           # API route handler
│       └── __tests__/
│           └── endpoint.test.ts

lib/
└── utility.ts                 # Utility functions
```

### API Routes

- Use proper HTTP status codes
- Implement request validation
- Add comprehensive error handling
- Use request-scoped logging (see `lib/logger.ts`)
- Follow existing patterns in `app/api/`

Example:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);

  try {
    const { data, error } = await supabase
      .from('table')
      .select('*');

    if (error) throw error;

    logger.logResponse('GET', '/api/endpoint', 200, Date.now() - startTime);
    return NextResponse.json({ data });
  } catch (error) {
    logger.logResponse('GET', '/api/endpoint', 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

### Writing Tests

- Write tests for new features
- Test edge cases and error scenarios
- Use descriptive test names
- Mock external dependencies

Example:
```typescript
import { render, screen } from '@testing-library/react';
import YourComponent from '../YourComponent';

describe('YourComponent', () => {
  it('renders correctly', () => {
    render(<YourComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('handles errors gracefully', () => {
    // Test error scenario
  });
});
```

## Submitting Changes

### Before Submitting

1. **Run tests:**
   ```bash
   npm test
   npm run lint
   ```

2. **Check TypeScript:**
   ```bash
   npm run build
   ```

3. **Update documentation** if needed

4. **Add tests** for new features

### Creating a Pull Request

1. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request** on GitHub

3. **Fill out the PR template** with:
   - Description of changes
   - Related issue numbers
   - Testing performed
   - Screenshots (for UI changes)

4. **Wait for review** and address feedback

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] No console.log or debug code
- [ ] TypeScript types are properly defined
- [ ] Commit messages follow convention
- [ ] Branch is up to date with master

## Documentation

When adding features:

1. Update relevant docs in `docs/`
2. Add JSDoc comments to functions
3. Update API documentation if adding/changing endpoints
4. Add usage examples

## Need Help?

- Check existing [documentation](./docs/INDEX.md)
- Review [API Developer Guide](./docs/guides/API_DEVELOPER_GUIDE.md)
- Look at existing code for patterns
- Ask questions in pull request comments

## Recognition

Contributors will be recognized in:
- Project README.md
- Release notes
- Contributors page (if created)

Thank you for contributing to Smart Summarizer! 🎉
