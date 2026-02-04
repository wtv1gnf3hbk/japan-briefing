#!/usr/bin/env node
/**
 * Config-driven news briefing scraper
 *
 * Reads sources from sources.json and scrapes them in parallel.
 * Supports multiple source types: rss, homepage, government
 *
 * Run: node generate-briefing.js
 * Output: briefing.json
 */

const https = require('https');
const http = require('http');
const cheerio = require('cheerio');
const fs = require('fs');

// ============================================
// CONFIGURATION
// ============================================

// Load sources from config file
const CONFIG_PATH = './sources.json';

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Config file not found: ${CONFIG_PATH}`);
    console.error('Create sources.json with your news sources. See sources.example.json for format.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

// ============================================
// FETCH UTILITIES
// ============================================

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html, application/rss+xml, application/xml, text/xml',
        ...options.headers
      }
    }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetch(res.headers.location, options).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(options.timeout || 15000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// ============================================
// HEADLINE CLEANING
// ============================================

function cleanHeadline(text) {
  if (!text) return null;
  let h = text.trim().replace(/\s+/g, ' ');
  // Remove common cruft
  h = h.replace(/^\d+\s*min\s*(read|listen)/i, '').trim();
  h = h.replace(/\d+\s*min\s*(read|listen)$/i, '').trim();
  // Length filter
  return (h.length >= 10 && h.length <= 300) ? h : null;
}

// ============================================
// SOURCE TYPE HANDLERS
// ============================================

/**
 * Parse RSS/Atom feed
 * Returns array of { headline, url, source, date, description }
 */
function parseRSS(xml, source) {
  const items = [];

  // Try RSS format first
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
    const itemXml = match[1];
    const title = (itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                   itemXml.match(/<title>(.*?)<\/title>/))?.[1]?.trim();
    const link = (itemXml.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>/) ||
                  itemXml.match(/<link>(.*?)<\/link>/) ||
                  itemXml.match(/<link[^>]*href="([^"]+)"/))?.[1]?.trim();
    const description = (itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                        itemXml.match(/<description>(.*?)<\/description>/))?.[1]?.trim();
    const pubDate = (itemXml.match(/<pubDate>(.*?)<\/pubDate>/))?.[1]?.trim();

    const headline = cleanHeadline(title?.replace(/<[^>]*>/g, ''));
    if (headline && link) {
      items.push({
        headline,
        url: link,
        source: source.name,
        sourceId: source.id,
        category: source.category || 'general',
        priority: source.priority || 'secondary',
        date: pubDate || null,
        description: description ? description.replace(/<[^>]*>/g, '').trim().slice(0, 200) : ''
      });
    }
  }

  // Try Atom format if RSS didn't find anything
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    while ((match = entryRegex.exec(xml)) !== null && items.length < 10) {
      const entryXml = match[1];
      const title = (entryXml.match(/<title[^>]*>(.*?)<\/title>/))?.[1]?.trim();
      const link = (entryXml.match(/<link[^>]*href="([^"]+)"/))?.[1]?.trim();
      const updated = (entryXml.match(/<updated>(.*?)<\/updated>/))?.[1]?.trim();

      const headline = cleanHeadline(title?.replace(/<[^>]*>/g, ''));
      if (headline && link) {
        items.push({
          headline,
          url: link,
          source: source.name,
          sourceId: source.id,
          category: source.category || 'general',
          priority: source.priority || 'secondary',
          date: updated || null,
          description: ''
        });
      }
    }
  }

  return items;
}

/**
 * Parse homepage with configurable selectors
 * source.selectors should have: { headline, item?, urlBase? }
 */
function parseHomepage(html, source) {
  const $ = cheerio.load(html);
  const stories = [];
  const seen = new Set();
  const selectors = source.selectors || {};

  // Default selectors if not specified
  const headlineSelector = selectors.headline || 'h2 a, h3 a';
  const itemSelector = selectors.item;
  const urlBase = selectors.urlBase || '';

  const processElement = ($el, $link) => {
    if (stories.length >= 10) return;

    let url = $link?.attr('href');
    if (!url) return;

    // Make URL absolute
    if (url.startsWith('/')) url = urlBase + url;

    // Skip if already seen
    if (seen.has(url)) return;

    // Get headline text
    let headline = $el.text().trim().replace(/\s+/g, ' ');
    headline = cleanHeadline(headline);
    if (!headline) return;

    seen.add(url);
    stories.push({
      headline,
      url,
      source: source.name,
      sourceId: source.id,
      category: source.category || 'general',
      priority: source.priority || 'secondary',
      date: null,
      description: ''
    });
  };

  // If item selector specified, use it as container
  if (itemSelector) {
    $(itemSelector).each((i, el) => {
      const $el = $(el);
      const $link = $el.find(headlineSelector).first();
      processElement($link.length ? $link : $el.find('a').first(), $link.length ? $link : $el.find('a').first());
    });
  } else {
    // Otherwise just find headline links directly
    $(headlineSelector).each((i, el) => {
      const $el = $(el);
      const $link = $el.is('a') ? $el : $el.find('a').first();
      if (!$link.length) return;
      processElement($el, $link);
    });
  }

  return stories;
}

/**
 * Parse government/official page with configurable selectors
 * Similar to homepage but optimized for press release formats
 */
function parseGovernmentPage(html, source) {
  const $ = cheerio.load(html);
  const stories = [];
  const seen = new Set();
  const selectors = source.selectors || {};

  const itemSelector = selectors.item || 'li, article, .press-release';
  const headlineSelector = selectors.headline || 'a';
  const dateSelector = selectors.date;
  const urlBase = selectors.urlBase || '';

  $(itemSelector).each((i, el) => {
    if (stories.length >= 10) return;

    const $el = $(el);
    const $link = $el.find(headlineSelector).first();

    let url = $link.attr('href');
    if (!url) return;

    if (url.startsWith('/')) url = urlBase + url;
    if (seen.has(url)) return;

    let headline = $link.text().trim().replace(/\s+/g, ' ');
    headline = cleanHeadline(headline);
    if (!headline) return;

    // Try to get date if selector specified
    let date = null;
    if (dateSelector) {
      date = $el.find(dateSelector).text().trim() || null;
    }

    seen.add(url);
    stories.push({
      headline,
      url,
      source: source.name,
      sourceId: source.id,
      category: source.category || 'government',
      priority: source.priority || 'secondary',
      date,
      description: ''
    });
  });

  return stories;
}

/**
 * Parse generic news homepage (BBC, Guardian style)
 * Auto-detects common patterns
 */
function parseNewsHomepage(html, source) {
  const $ = cheerio.load(html);
  const stories = [];
  const seen = new Set();
  const urlBase = source.selectors?.urlBase || '';

  // Try multiple selector strategies
  const strategies = [
    // Strategy 1: h2/h3 with links
    'h2 a, h3 a',
    // Strategy 2: data-testid headlines
    '[data-testid*="headline"] a, [data-testid*="Headline"] a',
    // Strategy 3: article cards
    'article h2 a, article h3 a, .article-card a',
    // Strategy 4: links with article-like URLs (year in path)
    `a[href*="/${new Date().getFullYear()}/"]`
  ];

  const addStory = (headline, url) => {
    if (stories.length >= 10) return false;
    if (!url || !headline) return false;

    if (url.startsWith('/')) url = urlBase + url;
    headline = cleanHeadline(headline);
    if (!headline) return false;
    if (seen.has(url)) return false;

    seen.add(url);
    stories.push({
      headline,
      url,
      source: source.name,
      sourceId: source.id,
      category: source.category || 'general',
      priority: source.priority || 'secondary',
      date: null,
      description: ''
    });
    return true;
  };

  // Try each strategy until we have enough stories
  for (const selector of strategies) {
    if (stories.length >= 5) break;

    $(selector).each((i, el) => {
      if (stories.length >= 10) return false;
      const $el = $(el);
      const url = $el.attr('href') || $el.find('a').attr('href');
      const headline = $el.text();
      addStory(headline, url);
    });
  }

  return stories;
}

// Handler registry
const HANDLERS = {
  rss: parseRSS,
  homepage: parseHomepage,
  government: parseGovernmentPage,
  news_homepage: parseNewsHomepage
};

// ============================================
// MAIN SCRAPING LOGIC
// ============================================

async function scrapeSource(source) {
  const handler = HANDLERS[source.type];
  if (!handler) {
    return {
      ...source,
      stories: [],
      error: `Unknown source type: ${source.type}`
    };
  }

  try {
    const content = await fetch(source.url);
    const stories = handler(content, source);
    return {
      ...source,
      stories,
      error: null,
      storyCount: stories.length
    };
  } catch (e) {
    return {
      ...source,
      stories: [],
      error: e.message
    };
  }
}

async function scrapeAll(config) {
  console.log(`Fetching ${config.sources.length} sources in parallel...`);
  console.log('');

  // Fetch all sources in parallel
  const results = await Promise.all(
    config.sources.map(source => scrapeSource(source))
  );

  // Process and organize results
  const allStories = [];
  const byCategory = {};
  const byPriority = { primary: [], secondary: [], tertiary: [], reference: [] };
  const failed = [];

  for (const result of results) {
    if (result.error) {
      console.log(`  ✗ ${result.name}: ${result.error}`);
      failed.push({ name: result.name, error: result.error });
      continue;
    }

    console.log(`  ✓ ${result.name} (${result.storyCount} stories)`);

    // Add stories to all collections
    for (const story of result.stories) {
      allStories.push(story);

      // Group by category
      const cat = story.category || 'general';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(story);

      // Group by priority
      const pri = story.priority || 'secondary';
      if (byPriority[pri]) byPriority[pri].push(story);
    }
  }

  // Deduplicate by URL
  const seen = new Set();
  const deduped = allStories.filter(story => {
    if (seen.has(story.url)) return false;
    seen.add(story.url);
    return true;
  });

  return {
    allStories: deduped,
    byCategory,
    byPriority,
    failed,
    sourceCount: config.sources.length,
    successCount: config.sources.length - failed.length
  };
}

// ============================================
// MAIN
// ============================================

async function main() {
  const config = loadConfig();

  console.log('='.repeat(50));
  console.log(`${config.metadata?.name || 'News Briefing'}`);
  console.log(`Owner: ${config.metadata?.owner || 'Unknown'}`);
  console.log(`Timezone: ${config.metadata?.timezone || 'UTC'}`);
  console.log(new Date().toISOString());
  console.log('='.repeat(50));
  console.log('');

  const startTime = Date.now();
  const results = await scrapeAll(config);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Build output
  const briefing = {
    metadata: {
      ...config.metadata,
      generated: new Date().toISOString(),
      generatedTimestamp: Date.now()
    },
    stats: {
      sourceCount: results.sourceCount,
      successCount: results.successCount,
      totalStories: results.allStories.length,
      elapsed: `${elapsed}s`
    },
    stories: {
      all: results.allStories,
      byCategory: results.byCategory,
      byPriority: results.byPriority
    },
    feedHealth: {
      failed: results.failed
    }
  };

  // Write output
  fs.writeFileSync('briefing.json', JSON.stringify(briefing, null, 2));

  // Summary
  console.log('');
  console.log('='.repeat(50));
  console.log('RESULTS');
  console.log('='.repeat(50));
  console.log(`Sources: ${results.successCount}/${results.sourceCount} succeeded`);
  console.log(`Stories: ${results.allStories.length} total`);

  // Show category breakdown
  console.log('\nBy category:');
  for (const [cat, stories] of Object.entries(results.byCategory)) {
    console.log(`  ${cat}: ${stories.length}`);
  }

  // Show priority breakdown
  console.log('\nBy priority:');
  for (const [pri, stories] of Object.entries(results.byPriority)) {
    if (stories.length > 0) {
      console.log(`  ${pri}: ${stories.length}`);
    }
  }

  if (results.failed.length > 0) {
    console.log(`\n⚠️  ${results.failed.length} sources failed`);
  }

  console.log(`\nTime: ${elapsed}s`);
  console.log('');

  // Exit with error if no stories
  if (results.allStories.length === 0) {
    console.error('❌ FAILED: No stories scraped');
    process.exit(1);
  }

  console.log('✅ SUCCESS - briefing.json written');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
