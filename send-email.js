#!/usr/bin/env node
/**
 * Send the daily Japan briefing via Resend
 *
 * Requires: RESEND_API_KEY environment variable
 *
 * Reads index.html and sends it as an HTML email to configured recipient
 */

const https = require('https');
const fs = require('fs');

// ============================================
// CONFIGURATION
// ============================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Recipient - the Tokyo Bureau Chief
const RECIPIENT = 'javier.hernandez@nytimes.com';

// Sender - must be a verified domain in Resend, or use their test domain
// You'll need to verify a domain in Resend dashboard, or use onboarding@resend.dev for testing
const SENDER = process.env.RESEND_SENDER || 'onboarding@resend.dev';

// ============================================
// TIMEZONE UTILITIES
// ============================================

function formatDate(timezone = 'Asia/Tokyo') {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone
  });
}

// ============================================
// HTML PROCESSING
// ============================================

/**
 * Extract the briefing content and create an email-optimized HTML version
 * - Converts relative screenshot paths to absolute GitHub Pages URLs
 * - Removes the refresh button (not useful in email)
 * - Ensures email client compatibility
 */
function processHTMLForEmail(html) {
  const GITHUB_PAGES_URL = 'https://wtv1gnf3hbk.github.io/japan-briefing';

  // Convert relative screenshot paths to absolute URLs
  let emailHTML = html.replace(
    /src="screenshots\//g,
    `src="${GITHUB_PAGES_URL}/screenshots/`
  );

  // Convert relative links to absolute
  emailHTML = emailHTML.replace(
    /href="screenshots\//g,
    `href="${GITHUB_PAGES_URL}/screenshots/`
  );

  // Remove the refresh link and its surrounding text since it won't work in email
  emailHTML = emailHTML.replace(
    /· <a class="refresh-link"[^>]*>Refresh<\/a>/g,
    ''
  );

  // Remove the JavaScript block (not needed in email)
  emailHTML = emailHTML.replace(
    /<script>[\s\S]*?<\/script>/g,
    ''
  );

  // Add "View online" link at the top
  emailHTML = emailHTML.replace(
    /<div class="header">/,
    `<div style="text-align: center; padding: 12px; background: #f0f0f0; margin-bottom: 16px; font-family: -apple-system, sans-serif; font-size: 13px;">
      <a href="${GITHUB_PAGES_URL}" style="color: #666;">View online with screenshots</a>
    </div>
    <div class="header">`
  );

  return emailHTML;
}

// ============================================
// RESEND API
// ============================================

function sendEmail(to, subject, htmlContent) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      from: SENDER,
      to: [to],
      subject: subject,
      html: htmlContent
    });

    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(`Resend API error: ${json.message || data}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(body);
    req.end();
  });
}

// ============================================
// MAIN
// ============================================

async function main() {
  if (!RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY environment variable');
    process.exit(1);
  }

  // Read the generated HTML
  if (!fs.existsSync('index.html')) {
    console.error('index.html not found. Run write-briefing.js first.');
    process.exit(1);
  }

  console.log('Reading index.html...');
  const html = fs.readFileSync('index.html', 'utf8');

  // Process for email
  console.log('Processing HTML for email...');
  const emailHTML = processHTMLForEmail(html);

  // Build subject line
  const dateStr = formatDate('Asia/Tokyo');
  const subject = `Tokyo Bureau Briefing — ${dateStr}`;

  console.log(`Sending to: ${RECIPIENT}`);
  console.log(`Subject: ${subject}`);

  try {
    const result = await sendEmail(RECIPIENT, subject, emailHTML);
    console.log('');
    console.log('✅ Email sent successfully');
    console.log(`   ID: ${result.id}`);
  } catch (e) {
    console.error('❌ Failed to send email:', e.message);
    process.exit(1);
  }
}

main();
