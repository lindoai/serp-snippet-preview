# SERP Snippet Preview

Preview how a page's title and description may appear in Google search results.

## API

```
GET /api/preview?url=https://example.com
```

Returns JSON with the page's title, description, display URL, character lengths, and any SEO issues detected.

## Deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lindoai/serp-snippet-preview)

## Environment

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
