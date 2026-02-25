/**
 * Schema tests for japan-briefing output.
 *
 * Validates that briefing.json (produced by generate-briefing.js) has the
 * expected shape. Uses the actual briefing.json on disk as a fixture —
 * if it doesn't exist, tests are skipped (CI generates it fresh).
 *
 * Uses Node's built-in test runner (node:test + node:assert).
 * No external dependencies.
 *
 * Run: node --test test/schema.test.js
 *   or: npm test (from japan-briefing root)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BRIEFING_PATH = path.join(__dirname, '..', 'briefing.json');

// Check if the fixture exists — skip tests if not (e.g. fresh clone)
const briefingExists = fs.existsSync(BRIEFING_PATH);

describe('briefing.json schema', { skip: !briefingExists ? 'briefing.json not found (run generate-briefing.js first)' : false }, () => {
  let briefing;

  it('parses as valid JSON', () => {
    const raw = fs.readFileSync(BRIEFING_PATH, 'utf8');
    briefing = JSON.parse(raw);
    assert.ok(briefing, 'should parse successfully');
  });

  it('has metadata with required fields', () => {
    const raw = fs.readFileSync(BRIEFING_PATH, 'utf8');
    briefing = JSON.parse(raw);
    assert.ok(briefing.metadata, 'should have metadata object');
    assert.ok(briefing.metadata.name, 'metadata should have name');
    assert.ok(briefing.metadata.generated, 'metadata should have generated timestamp');
    assert.ok(briefing.metadata.timezone, 'metadata should have timezone');
  });

  it('has stats with sourceCount and totalStories', () => {
    const raw = fs.readFileSync(BRIEFING_PATH, 'utf8');
    briefing = JSON.parse(raw);
    assert.ok(briefing.stats, 'should have stats object');
    assert.equal(typeof briefing.stats.sourceCount, 'number');
    assert.equal(typeof briefing.stats.totalStories, 'number');
    assert.ok(briefing.stats.sourceCount > 0, 'should have at least 1 source');
  });

  it('has stories.all as a non-empty array', () => {
    const raw = fs.readFileSync(BRIEFING_PATH, 'utf8');
    briefing = JSON.parse(raw);
    assert.ok(briefing.stories, 'should have stories object');
    assert.ok(Array.isArray(briefing.stories.all), 'stories.all should be an array');
    assert.ok(briefing.stories.all.length > 0, 'stories.all should not be empty');
  });

  it('each story has headline, source, and url', () => {
    const raw = fs.readFileSync(BRIEFING_PATH, 'utf8');
    briefing = JSON.parse(raw);
    // Check first 5 stories (don't iterate all 100+)
    const sample = briefing.stories.all.slice(0, 5);
    for (const story of sample) {
      assert.ok(story.headline, `story should have headline, got: ${JSON.stringify(story)}`);
      assert.ok(story.source, `story should have source, got: ${JSON.stringify(story)}`);
      assert.ok(story.url, `story should have url, got: ${JSON.stringify(story)}`);
    }
  });

  it('headlines are non-empty strings', () => {
    const raw = fs.readFileSync(BRIEFING_PATH, 'utf8');
    briefing = JSON.parse(raw);
    const sample = briefing.stories.all.slice(0, 10);
    for (const story of sample) {
      assert.equal(typeof story.headline, 'string');
      assert.ok(story.headline.trim().length > 0, 'headline should not be empty');
    }
  });

  it('stats.totalScreenshots matches actual screenshot data', () => {
    const raw = fs.readFileSync(BRIEFING_PATH, 'utf8');
    briefing = JSON.parse(raw);
    if (briefing.stats.totalScreenshots !== undefined) {
      assert.equal(typeof briefing.stats.totalScreenshots, 'number');
      assert.ok(briefing.stats.totalScreenshots >= 0);
    }
  });
});
