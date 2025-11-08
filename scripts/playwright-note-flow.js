// Playwright script to open the app and reproduce Note Details + comment flow
// Saves console logs to playwright-console.log and network requests to playwright-requests.json
// Usage: node scripts/playwright-note-flow.js

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const outDir = path.resolve(__dirname, '..', 'playwright-logs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const consoleLogs = [];
  const requests = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ recordHar: { path: path.join(outDir, 'flow.har') } });
  const page = await context.newPage();

  page.on('console', msg => {
    const entry = { type: msg.type(), text: msg.text(), location: msg.location() };
    consoleLogs.push(entry);
    console.log('[console]', entry);
  });

  page.on('request', req => {
    requests.push({ url: req.url(), method: req.method(), headers: req.headers(), timestamp: Date.now() });
  });

  page.on('response', async res => {
    try {
      const ct = res.headers()['content-type'] || '';
      let body = null;
      if (ct.includes('application/json')) {
        body = await res.json().catch(() => null);
      } else {
        body = (await res.text().catch(() => null))?.slice(0, 200);
      }
      requests.push({ url: res.url(), status: res.status(), body, timestamp: Date.now(), type: 'response' });
    } catch (e) {
      // ignore
    }
  });

  const base = process.env.BASE_URL || 'http://localhost:3000';
  console.log('Opening app at', base);

  try {
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Try to find a "History" or "Notes" list and click the first note details button
    // This is intentionally defensive: we try several selectors and fall back to clicking the first list item

    // Wait a bit for client-side render
    await page.waitForTimeout(1500);

    const selectorsToTry = [
      'text=History',
      'text=Notes',
      '[data-testid="history-list"]',
      'ul li a',
      'article a',
      '[role="listitem"]'
    ];

    let clicked = false;
    for (const sel of selectorsToTry) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click().catch(() => {});
          clicked = true;
          console.log('Clicked selector', sel);
          break;
        }
      } catch (e) {
        // ignore
      }
    }

    // If not clicked, try to click the first card-like element
    if (!clicked) {
      const first = await page.$('main a, main button, main [role="button"]');
      if (first) {
        await first.click().catch(() => {});
        console.log('Clicked fallback main element');
      }
    }

    // Wait for a Note Details dialog to appear - try common dialog selectors
    await page.waitForTimeout(1000);

    const dialogSelectors = ['dialog', '[role="dialog"]', '.note-details', '.details-dialog', '.modal'];
    let dialogFound = false;
    for (const s of dialogSelectors) {
      const d = await page.$(s);
      if (d) {
        dialogFound = true;
        console.log('Found dialog using', s);
        break;
      }
    }

    // Try to find comment textarea / input and post a comment
    const commentSelectors = [
      'textarea[placeholder*="comment"]',
      'textarea[placeholder*="Comment"]',
      'textarea',
      'input[placeholder*="comment"]',
      '[data-testid="comment-input"]'
    ];

    let commentPosted = false;
    for (const cs of commentSelectors) {
      const el = await page.$(cs);
      if (el) {
        try {
          await el.fill('Playwright test comment — automated.');
          await page.waitForTimeout(250);
          // Try to find a Post button nearby
          const postBtn = await page.$('button:has-text("Post"), button:has-text("Send"), button:has-text("Reply")');
          if (postBtn) {
            await postBtn.click();
            commentPosted = true;
            console.log('Clicked Post button');
          } else {
            // Press Enter if it's an input
            await el.press('Enter').catch(() => {});
            console.log('Pressed Enter on comment input');
            commentPosted = true;
          }
          break;
        } catch (e) {
          // ignore
        }
      }
    }

    // Wait for any network activity to settle
    await page.waitForTimeout(2500);

    // Try to close dialog via common close buttons
    const closeSelectors = ['button[aria-label="Close"]', 'button:has-text("Close")', '.modal-close', '.dialog-close', 'button:has-text("×")'];
    for (const cs of closeSelectors) {
      const c = await page.$(cs);
      if (c) {
        await c.click().catch(() => {});
        console.log('Clicked close selector', cs);
        break;
      }
    }

    // Final pause
    await page.waitForTimeout(1000);

    // Write logs
    fs.writeFileSync(path.join(outDir, 'playwright-console.log'), JSON.stringify(consoleLogs, null, 2));
    fs.writeFileSync(path.join(outDir, 'playwright-requests.json'), JSON.stringify(requests, null, 2));

    console.log('Flow finished. HAR saved to', path.join(outDir, 'flow.har'));
    console.log('Console log saved to', path.join(outDir, 'playwright-console.log'));
    console.log('Requests saved to', path.join(outDir, 'playwright-requests.json'));

  } catch (err) {
    console.error('Error during flow:', err && err.message ? err.message : err);
  } finally {
    await browser.close();
  }
})();