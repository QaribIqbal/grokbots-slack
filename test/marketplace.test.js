import { test } from "node:test";
import assert from "node:assert/strict";
import { findSlug, parseBotPage, slugCandidates } from "../src/marketplace.js";

const catalog = `
<a href="/bot/marketplace/bots/clip-bot">Clip Bot</a>
<a href="/bot/marketplace/bots/researchy">Researchy</a>
<a href="/bot/marketplace/bots/qa-bot">QA bot</a>
`;

const botPage = `
<title>Clip Bot · Grok Bot Marketplace</title>
<a href="/bot/marketplace">Back</a>
<a href="/bot/-L1yFJ5mtwPgn3O_iYUo_">Import Bot</a>
<a href="grokbot://app/v1/bot-template?id=-L1yFJ5mtwPgn3O_iYUo_">Add</a>
`;

test("ClipBot and Clip Bot both match the clip-bot listing", () => {
  assert.deepEqual(slugCandidates("Clip Bot"), ["clip-bot", "clipbot"]);
  assert.equal(findSlug(catalog, "ClipBot"), "clip-bot");
  assert.equal(findSlug(catalog, "clip-bot"), "clip-bot");
  assert.equal(findSlug(catalog, "missing"), null);
});

test("a bot page yields the Grok Bot add link", () => {
  const install = parseBotPage(botPage);
  assert.equal(install.templateId, "-L1yFJ5mtwPgn3O_iYUo_");
  assert.equal(install.templateUrl, "https://x.ai/bot/-L1yFJ5mtwPgn3O_iYUo_");
  assert.equal(
    install.appUrl,
    "grokbot://app/v1/bot-template?id=-L1yFJ5mtwPgn3O_iYUo_",
  );
});
