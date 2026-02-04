#!/usr/bin/env node
/**
 * Send the daily Japan briefing via Gmail SMTP
 *
 * Requires environment variables:
 * - GMAIL_USER: your Gmail address (e.g., adampasick@gmail.com)
 * - GMAIL_APP_PASSWORD: 16-character app password from Google
 *
 * To get an app password:
 * 1. Go to https://myaccount.google.com/apppasswords
 * 2. Select "Mail" and your device
 * 3. Copy the 16-character password (no spaces)
 */

const nodemailer = require('nodemailer');
const fs = require('fs');

// ============================================
// CONFIGURATION
// ============================================

const GMAIL_USER = process.env.GMAIL_USER || 'adampasick@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

// Recipient - the Tokyo Bureau Chief
const RECIPIENT = 'javier.hernandez@nytimes.com';

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
 * Process HTML for email delivery
 * - Converts relative screenshot paths to absolute GitHub Pages URLs
 * - Removes the refresh button (not useful in email)
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

  // Remove the refresh link since it won't work in email
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
// MAIN
// ============================================

async function main() {
  if (!GMAIL_APP_PASSWORD) {
    console.error('Missing GMAIL_APP_PASSWORD environment variable');
    console.error('');
    console.error('To get an app password:');
    console.error('1. Go to https://myaccount.google.com/apppasswords');
    console.error('2. Generate a new app password for "Mail"');
    console.error('3. Set GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx');
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

  console.log(`From: ${GMAIL_USER}`);
  console.log(`To: ${RECIPIENT}`);
  console.log(`Subject: ${subject}`);

  // Create Gmail transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD
    }
  });

  try {
    const result = await transporter.sendMail({
      from: GMAIL_USER,
      to: RECIPIENT,
      subject: subject,
      html: emailHTML
    });

    console.log('');
    console.log('✅ Email sent successfully');
    console.log(`   Message ID: ${result.messageId}`);
  } catch (e) {
    console.error('❌ Failed to send email:', e.message);
    process.exit(1);
  }
}

main();
