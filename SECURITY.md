# Security Policy

## Supported Versions

Currently supported versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow these steps:

### 1. **Do Not** Open a Public Issue

Please do not create a public GitHub issue for security vulnerabilities. This helps protect users before a fix is available.

### 2. Report Privately

Send security reports to: **security@[your-domain].com** (or create a private GitHub Security Advisory)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### 3. Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: Within 24-48 hours
  - High: Within 7 days
  - Medium: Within 30 days
  - Low: Next release cycle

## Security Best Practices

### For Users

1. **Environment Variables**
   - Never commit `.env.local` or `.env` files
   - Use strong, unique API keys
   - Rotate keys periodically
   - Keep Supabase and GROQ API keys secret

2. **Authentication**
   - Use strong passwords
   - Enable 2FA when available
   - Don't share login credentials

3. **Data Encryption**
   - Use client-side encryption for sensitive notes
   - Be cautious with public note sharing

### For Contributors

1. **Code Security**
   - Validate all user inputs
   - Sanitize data before database queries
   - Use parameterized queries (Supabase handles this)
   - Avoid `eval()` and similar dangerous functions

2. **Dependencies**
   - Run `npm audit` regularly
   - Keep dependencies up to date
   - Review dependency changes in PRs

3. **API Security**
   - Use proper authentication checks
   - Implement rate limiting (see `lib/apiMiddleware.ts`)
   - Validate request payloads
   - Return appropriate error messages (don't leak sensitive info)

4. **Database Security**
   - Use Supabase RLS policies
   - Never bypass RLS in production
   - Test RLS policies thoroughly
   - Use service_role key only in secure server contexts

## Known Security Considerations

### 1. Client-Side Encryption

Notes encrypted client-side cannot be:
- Searched by the server
- Backed up without the encryption key
- Recovered if the key is lost

**Recommendation:** Users should backup encryption keys securely.

### 2. Guest Mode

Guest mode stores data in localStorage:
- Data is not encrypted by default
- Data persists on the device only
- Clearing browser data will delete notes

**Recommendation:** Users should sign up for persistent, secure storage.

### 3. Real-time Collaboration

WebSocket connections for real-time features:
- Use Supabase authenticated connections
- Validate all real-time messages
- RLS policies apply to real-time queries

### 4. File Uploads (PDF)

- Max file size: 100MB
- Accepts only PDF files
- Extracted text is stored in the database
- Files are stored in Supabase Storage with RLS

**Recommendation:** Don't upload sensitive documents to production without client-side encryption.

## Security Features

### Implemented

- ✅ Row-Level Security (RLS) on all Supabase tables
- ✅ Supabase Authentication with multiple providers
- ✅ Client-side AES encryption for sensitive notes
- ✅ HTTPS in production (via Vercel/deployment platform)
- ✅ Rate limiting on API endpoints
- ✅ Input validation and sanitization
- ✅ Sentry error monitoring
- ✅ Environment variable management
- ✅ Secure session management
- ✅ Content Security Policy headers

### Roadmap

- ⏳ Two-factor authentication (2FA)
- ⏳ Audit logs for sensitive operations
- ⏳ IP-based rate limiting
- ⏳ Advanced DDoS protection
- ⏳ Automated security scanning in CI/CD
- ⏳ Regular penetration testing

## Vulnerability Disclosure

When a vulnerability is fixed:

1. We will release a patch version
2. Update this document with details (after fix is deployed)
3. Credit the reporter (if they wish)
4. Publish a security advisory on GitHub

## Security Checklist for Deployment

Before deploying to production:

- [ ] All environment variables are set securely
- [ ] `.env.local` is in `.gitignore`
- [ ] Database RLS policies are enabled and tested
- [ ] API rate limiting is configured
- [ ] Sentry (or error tracking) is set up
- [ ] HTTPS is enabled
- [ ] File upload limits are enforced
- [ ] Input validation is implemented
- [ ] Authentication is required for protected routes
- [ ] Secrets are rotated regularly

## Contact

For security concerns:
- Email: security@[your-domain].com
- GitHub: Create a private security advisory

Thank you for helping keep Smart Summarizer secure! 🔒
