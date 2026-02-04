# Japan Briefing

Config-driven news briefing generator for the NYT Tokyo Bureau.

## Quick Start

```bash
# Install dependencies
npm install

# Generate briefing (scrape + write)
npm run briefing

# Or run steps separately
npm run generate  # Scrape sources → briefing.json
npm run write     # Claude API → index.html
```

## How It Works

1. **`generate-briefing.js`** reads `sources.json` and scrapes all configured sources in parallel
2. **`write-briefing.js`** sends the scraped data to Claude API, which writes a conversational briefing
3. **GitHub Actions** runs this daily at 7am JST and commits the output

## Configuration

Edit `sources.json` to add/remove sources. See `sources.example.json` for all options.

### Source Types

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `rss` | RSS/Atom feeds | `url` |
| `homepage` | HTML scraping with CSS selectors | `url`, `selectors.headline`, `selectors.urlBase` |
| `government` | Press release pages | `url`, `selectors.item`, `selectors.headline`, `selectors.urlBase` |
| `news_homepage` | Auto-detect patterns (BBC, Guardian style) | `url`, `selectors.urlBase` |

### Priority Levels

- `primary` - Always include in briefing
- `secondary` - Include if relevant
- `tertiary` - Include if notable
- `reference` - For context, not necessarily in output

### Categories

- `national` - Japan domestic news
- `business` - Business, markets, economy
- `regional` - Asia-Pacific
- `wire` - Wire services
- `government` - Official sources

## GitHub Actions Setup

1. Go to repo Settings > Secrets and variables > Actions
2. Add secrets:
   - `ANTHROPIC_API_KEY` - Claude API key for generating briefing
   - `RESEND_API_KEY` - Resend API key for email delivery
3. Enable GitHub Pages (Settings > Pages > Deploy from branch: main)

## Email Setup (Resend)

The briefing is emailed automatically to javier.hernandez@nytimes.com after each run.

**To get a Resend API key:**
1. Sign up at https://resend.com
2. Go to API Keys in the dashboard
3. Create a new key and add it as `RESEND_API_KEY` secret in GitHub

**Sender domain:** Currently uses Resend's test domain (`onboarding@resend.dev`).
To use a custom sender address:
1. Verify a domain in Resend dashboard
2. Set `RESEND_SENDER` environment variable in the workflow

**Local testing:**
```bash
export RESEND_API_KEY=your_key
npm run email  # Send the current index.html
```

## Writing Rules

The Claude prompt enforces:
- No "amid" (lazy jargon)
- Max 3-word link text
- No 's contractions for "is/has" (only possessives)
- Conversational tone
- Full sentences, not headline fragments

## File Structure

```
japan-briefing/
├── generate-briefing.js    # Scraper (config-driven)
├── write-briefing.js       # Claude API integration
├── sources.json            # Your source config (edit this!)
├── sources.example.json    # Reference for all options
├── package.json
├── .github/workflows/
│   └── briefing.yml        # Daily automation
├── briefing.json           # Generated: scraped data
├── briefing.md             # Generated: markdown
└── index.html              # Generated: styled HTML
```

## Adding a New Source

1. Find the RSS feed URL (try `/feed`, `/rss`, `/rss.xml`)
2. Add to `sources.json`:

```json
{
  "id": "source_id",
  "name": "Source Name",
  "type": "rss",
  "url": "https://example.com/feed",
  "priority": "secondary",
  "category": "national"
}
```

3. Test: `npm run generate`
4. Commit and push

## Troubleshooting

**Source returning 0 stories:**
- Check if the URL is correct
- For homepage scraping, verify CSS selectors in browser DevTools
- RSS feeds may have changed format

**Claude API errors:**
- Check `ANTHROPIC_API_KEY` is set
- API may be rate limited

**GitHub Actions failing:**
- Check Actions logs for specific error
- Verify secrets are configured
