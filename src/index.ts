import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { parseHTML } from 'linkedom';
import { readTurnstileTokenFromUrl, verifyTurnstileToken } from '../../_shared/turnstile';
import { renderTextToolPage, turnstileSiteKeyFromEnv } from '../../_shared/tool-page';

type Env = { Bindings: { TURNSTILE_SITE_KEY?: string; TURNSTILE_SECRET_KEY?: string } };

const app = new Hono<Env>();
app.use('/api/*', cors());

app.get('/', (c) =>
  c.html(
    renderTextToolPage({
      title: 'SERP Snippet Preview',
      description: 'Preview how a page\'s title and description may appear in Google search results.',
      endpoint: '/api/preview',
      sample: '{ "url": "https://example.com", "title": "Example Domain", "description": "This domain is for use in illustrative examples..." }',
      siteKey: turnstileSiteKeyFromEnv(c.env),
      buttonLabel: 'Preview',
      toolSlug: 'serp-snippet-preview',
    })
  )
);

app.get('/health', (c) => c.json({ ok: true }));

app.get('/api/preview', async (c) => {
  const captcha = await verifyTurnstileToken(
    c.env,
    readTurnstileTokenFromUrl(c.req.url),
    c.req.header('CF-Connecting-IP')
  );
  if (!captcha.ok) return c.json({ error: captcha.error }, 403);

  const normalized = normalizeUrl(c.req.query('url') ?? '');
  if (!normalized) return c.json({ error: 'A valid http(s) URL is required.' }, 400);

  const html = await fetchHtml(normalized);
  if (!html) return c.json({ error: 'Failed to fetch page.' }, 502);

  const { document } = parseHTML(html);

  const rawTitle =
    document.querySelector('title')?.textContent?.trim() ?? '';
  const metaDesc =
    document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? '';
  const canonical =
    document.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() ?? normalized;

  const titleLength = rawTitle.length;
  const descriptionLength = metaDesc.length;

  const displayTitle = rawTitle.length > 60 ? rawTitle.slice(0, 60) + '...' : rawTitle;
  const displayDescription = metaDesc.length > 160 ? metaDesc.slice(0, 160) + '...' : metaDesc;

  const parsedUrl = new URL(canonical.startsWith('http') ? canonical : normalized);
  const displayUrl = parsedUrl.hostname + parsedUrl.pathname.replace(/\/$/, '');

  const issues: string[] = [];
  if (!rawTitle) issues.push('Title missing');
  else if (titleLength > 60) issues.push('Title too long');
  else if (titleLength < 30) issues.push('Title too short');
  if (!metaDesc) issues.push('Description missing');
  else if (descriptionLength > 160) issues.push('Description too long');
  else if (descriptionLength < 70) issues.push('Description too short');

  return c.json({
    url: normalized,
    title: displayTitle,
    description: displayDescription,
    displayUrl,
    titleLength,
    descriptionLength,
    issues,
  });
});

async function fetchHtml(url: string) {
  const r = await fetch(url, {
    headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'Lindo Free Tools/1.0 (+https://lindo.ai/tools)' },
  }).catch(() => null);
  return r?.ok ? r.text() : null;
}

function normalizeUrl(value: string): string | null {
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).toString();
  } catch {
    return null;
  }
}

export default app;
