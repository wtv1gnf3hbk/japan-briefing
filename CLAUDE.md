# Tokyo Bureau Briefing

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
2. Add secret: `ANTHROPIC_API_KEY`
3. Enable GitHub Pages (Settings > Pages > Deploy from branch: main)

## Writing Rules

The Claude prompt enforces:
- No "amid" (lazy jargon)
- Max 3-word link text
- No 's contractions for "is/has" (only possessives)
- Conversational tone
- Full sentences, not headline fragments

## File Structure

```
tokyo-briefing/
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
