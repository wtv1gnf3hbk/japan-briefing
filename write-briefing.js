#!/usr/bin/env node
/**
 * Calls Claude API to write a conversational briefing from briefing.json
 * Outputs briefing.md (markdown) and index.html (styled page)
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 */

const https = require('https');
const fs = require('fs');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY environment variable');
  process.exit(1);
}

// ============================================
// CLAUDE API CALL
// ============================================

function callClaude(prompt, systemPrompt = '') {
  return new Promise((resolve, reject) => {
    const messages = [{ role: 'user', content: prompt }];

    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      system: systemPrompt,
      messages
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message));
          } else {
            resolve(json.content[0].text);
          }
        } catch (e) {
          reject(new Error('Failed to parse API response: ' + data.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('API timeout'));
    });

    req.write(body);
    req.end();
  });
}

// ============================================
// TIMEZONE UTILITIES
// ============================================

function formatTimestamp(timezone = 'Asia/Tokyo') {
  const now = new Date();

  // Format date
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone
  });

  // Format time
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone
  });

  // Get timezone abbreviation
  const tzAbbr = now.toLocaleTimeString('en-US', {
    timeZone: timezone,
    timeZoneName: 'short'
  }).split(' ').pop();

  return { dateStr, timeStr, tzAbbr, full: `${dateStr} at ${timeStr} ${tzAbbr}` };
}

// ============================================
// HTML GENERATION
// ============================================

function generateHTML(briefingText, config) {
  const timezone = config.metadata?.timezone || 'Asia/Tokyo';
  const timestamp = formatTimestamp(timezone);
  const title = config.metadata?.name || 'Tokyo Bureau Briefing';
  const screenshots = config.screenshots || [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      line-height: 1.7;
      max-width: 680px;
      margin: 0 auto;
      padding: 32px 16px;
      background: #fafafa;
      color: #1a1a1a;
    }
    .header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e0e0e0;
    }
    .title {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .timestamp {
      font-size: 0.85rem;
      color: #666;
    }
    .refresh-link {
      color: #666;
      text-decoration: underline;
      cursor: pointer;
    }
    h1, h2, strong {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    p { margin-bottom: 16px; }
    ul { margin: 12px 0 20px 0; padding-left: 0; list-style: none; }
    li { margin-bottom: 10px; padding-left: 16px; position: relative; }
    li::before { content: "•"; position: absolute; left: 0; color: #999; }
    a {
      color: #1a1a1a;
      text-decoration: underline;
      text-decoration-color: #999;
      text-underline-offset: 2px;
    }
    a:hover { text-decoration-color: #333; }
    strong { font-weight: 600; }
    .section-header { margin-top: 24px; margin-bottom: 12px; }
    .screenshots-section {
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid #e0e0e0;
    }
    .screenshots-header {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .screenshots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }
    .screenshot-card {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
      background: white;
    }
    .screenshot-card img {
      width: 100%;
      height: auto;
      display: block;
    }
    .screenshot-card .label {
      padding: 8px 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 0.85rem;
      background: #f5f5f5;
      border-top: 1px solid #e0e0e0;
    }
    .screenshot-card .label a {
      color: #666;
      text-decoration: none;
    }
    .screenshot-card .label a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${title}</div>
    <div class="timestamp">
      Generated ${timestamp.full}
      · <a class="refresh-link" onclick="refreshBriefing()">Refresh</a>
    </div>
  </div>

  <script>
    async function refreshBriefing() {
      const link = event.target;
      link.textContent = 'Triggering...';
      // Manual refresh - user triggers GitHub Actions manually
      // Or implement a webhook here if you set one up
      alert('To refresh: Go to the GitHub repo > Actions > Run workflow manually');
      link.textContent = 'Refresh';
    }
  </script>

  <div id="content">
${briefingText
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
  .replace(/^- (.+)$/gm, '<li>$1</li>')
  .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
  .split('\n')
  .map(line => {
    if (line.startsWith('<ul>') || line.startsWith('<li>') || line.startsWith('</ul>')) return line;
    if (line.startsWith('<strong>')) return `<p class="section-header">${line}</p>`;
    if (line.trim() && !line.startsWith('<')) return `<p>${line}</p>`;
    return line;
  })
  .join('\n')}
  </div>

  ${screenshots.length > 0 ? `
  <div class="screenshots-section">
    <div class="screenshots-header">📸 Homepage Screenshots</div>
    <div class="screenshots-grid">
      ${screenshots.map(s => `
      <div class="screenshot-card">
        <a href="${s.url}" target="_blank">
          <img src="screenshots/${s.filename}" alt="${s.name}" loading="lazy">
        </a>
        <div class="label">
          <a href="${s.url}" target="_blank">${s.name}</a>
          ${s.language && s.language !== 'en' ? `<span style="color:#999">(${s.language})</span>` : ''}
        </div>
      </div>
      `).join('')}
    </div>
  </div>
  ` : ''}
</body>
</html>`;
}

// ============================================
// PROMPT BUILDING
// ============================================

function buildPrompt(briefing) {
  const config = briefing.metadata || {};
  const ownerName = config.owner || 'the bureau chief';
  const timezone = config.timezone || 'Asia/Tokyo';

  // Get current time in the target timezone for greeting
  const hour = new Date().toLocaleString('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: timezone
  });
  const hourNum = parseInt(hour);

  let greeting;
  if (hourNum >= 5 && hourNum < 12) {
    greeting = 'Good morning from Tokyo.';
  } else if (hourNum >= 12 && hourNum < 17) {
    greeting = 'Good afternoon from Tokyo.';
  } else if (hourNum >= 17 && hourNum < 21) {
    greeting = 'Good evening from Tokyo.';
  } else {
    greeting = "Here's your briefing from Tokyo.";
  }

  // Organize stories for the prompt
  const stories = briefing.stories || {};
  const byCategory = stories.byCategory || {};
  const byPriority = stories.byPriority || {};

  // Condense for token efficiency
  const condensed = {
    primary: (byPriority.primary || []).slice(0, 8),
    secondary: (byPriority.secondary || []).slice(0, 10),
    national: (byCategory.national || []).slice(0, 5),
    business: (byCategory.business || []).slice(0, 5),
    regional: (byCategory.regional || []).slice(0, 5),
    government: (byCategory.government || []).slice(0, 5),
    wire: (byCategory.wire || []).slice(0, 5)
  };

  // Get screenshots info
  const screenshots = briefing.screenshots || [];

  const systemPrompt = `You are writing a morning news briefing for ${ownerName}, the Tokyo Bureau Chief for the New York Times.

Your job is to synthesize the scraped headlines into a conversational, readable briefing focused on Japan and the Asia-Pacific region.

CRITICAL RULES:
1. NEVER use the word "amid" - it's lazy jargon. Find a better way to connect ideas.
2. Link text must be MAX 3 WORDS.
   - GOOD: "Japan [raised rates](url) yesterday"
   - BAD: "[Bank of Japan announces interest rate increase](url)"
3. NEVER use 's as a contraction for "is" or "has" - only use 's for possessives.
   - BAD: "Toyota's planning" → GOOD: "Toyota is planning"
   - BAD: "Japan's facing" → GOOD: "Japan is facing"
   - OK: "Japan's economy" (possessive)
4. Write in full sentences, not headline fragments.
5. Be conversational, like chatting with a well-informed colleague.
6. NEVER use em-dashes to join independent clauses. Write separate sentences.`;

  const userPrompt = `${greeting} Here's what's happening:

Write a conversational briefing using this headline data. Structure it as:

1. **Opening** (2-3 paragraphs): Synthesize the top Japan stories. Lead with context and stakes, not just headlines.

2. **Business & Markets** (3-4 bullets): Japan/Asia business news, market moves, corporate stories.

3. **Government & Policy** (if relevant): Any notable official announcements, ministry statements, diplomatic developments.

4. **What to Watch** (1-2 items): Upcoming events or developing stories directly relevant to Japan. Skip this section entirely if there's nothing Japan-specific worth flagging.

Every bullet must have at least one link. Vary attribution: "Reuters reports", "according to Nikkei", "the Yomiuri notes", "per Kyodo" (use "per X" only once).

FLAG any stories where:
- International outlets are ahead of Japanese press
- A story might warrant NYT Tokyo bureau coverage
- There's a notable gap between Japanese and English coverage

Here's the data:

PRIMARY STORIES (lead with these):
${JSON.stringify(condensed.primary, null, 2)}

SECONDARY STORIES:
${JSON.stringify(condensed.secondary, null, 2)}

NATIONAL NEWS:
${JSON.stringify(condensed.national, null, 2)}

BUSINESS:
${JSON.stringify(condensed.business, null, 2)}

REGIONAL:
${JSON.stringify(condensed.regional, null, 2)}

GOVERNMENT/OFFICIAL:
${JSON.stringify(condensed.government, null, 2)}

WIRE SERVICES:
${JSON.stringify(condensed.wire, null, 2)}

HOMEPAGE SCREENSHOTS CAPTURED (Japanese outlets, competitors, Twitter):
${screenshots.map(s => `- ${s.name} (${s.language || 'en'}): screenshots/${s.filename}`).join('\n')}

TWITTER/X FEED CONTENT (translated where available):
${screenshots
  .filter(s => s.category === 'twitter' && s.tweets && s.tweets.length > 0)
  .map(s => `**${s.name}** (@${s.url.split('/').pop()}):\n${s.tweets.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`)
  .join('\n\n') || 'No tweet content extracted'}

IMPORTANT: If a tweet from an official account (PM, ministry, etc.) relates to a top story, cite it directly in your opening. Twitter/X feeds from officials are primary sources.

Note: Screenshots are available for visual reference. Include a note at the end listing which Japanese outlet homepages and Twitter feeds have been captured for reference.

Write the briefing now. Keep it concise but comprehensive.`;

  return { systemPrompt, userPrompt };
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('Reading briefing.json...');

  if (!fs.existsSync('briefing.json')) {
    console.error('briefing.json not found. Run generate-briefing.js first.');
    process.exit(1);
  }

  const briefing = JSON.parse(fs.readFileSync('briefing.json', 'utf8'));

  console.log(`Found ${briefing.stats?.totalStories || 0} stories`);
  console.log('');

  // Build prompt
  const { systemPrompt, userPrompt } = buildPrompt(briefing);

  console.log('Calling Claude API...');
  const startTime = Date.now();

  try {
    const briefingText = await callClaude(userPrompt, systemPrompt);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Claude responded in ${elapsed}s`);

    // Save markdown
    fs.writeFileSync('briefing.md', briefingText);
    console.log('Saved briefing.md');

    // Save HTML
    const htmlContent = generateHTML(briefingText, briefing);
    fs.writeFileSync('index.html', htmlContent);
    console.log('Saved index.html');

    console.log('');
    console.log('✅ Briefing written successfully');

  } catch (e) {
    console.error('❌ Failed to write briefing:', e.message);
    process.exit(1);
  }
}

main();
