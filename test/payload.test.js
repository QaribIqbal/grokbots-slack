import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPayload, resolveIdentity, toSlackText } from "../src/payload.js";
import { crewManifests, createAppUrl } from "../src/manifest.js";
import { CONTENT_CHANNEL, PEOPLE } from "../src/roles.js";

test("shared bot token labels the message with the role name", () => {
  const { identity, payload } = buildPayload({
    roleKey: "scout",
    text: "The claim checks out.",
    threadTs: "1791034695.901849",
    mentionPerson: "rio",
    env: { SLACK_BOT_TOKEN: "xoxb-shared" },
  });
  assert.equal(identity.mode, "customize");
  assert.equal(payload.username, "Scout");
  assert.equal(payload.icon_emoji, ":mag:");
  assert.equal(payload.channel, CONTENT_CHANNEL.id);
  assert.equal(payload.thread_ts, "1791034695.901849");
  assert.match(payload.text, new RegExp(`^<@${PEOPLE.rio.id}>`));
  assert.match(payload.text, /— Scout$/);
});

test("a role bot token posts as that member and does not override the name", () => {
  const { identity, payload } = buildPayload({
    roleKey: "maestro",
    text: "Package is ready.",
    env: {
      SLACK_BOT_TOKEN: "xoxb-shared",
      SLACK_BOT_TOKEN_MAESTRO: "xoxb-maestro",
    },
  });
  assert.equal(identity.mode, "member");
  assert.equal(identity.token, "xoxb-maestro");
  assert.equal(payload.username, undefined);
  assert.equal(payload.icon_emoji, undefined);
  assert.match(payload.text, /— Maestro$/);
});

test("missing token is reported instead of falling back to a personal user", () => {
  const identity = resolveIdentity("pixel", {});
  assert.equal(identity.mode, "missing");
  assert.equal(identity.token, null);
});

test("markdown bold and links become Slack mrkdwn", () => {
  assert.equal(toSlackText("See **this** [clip](https://example.com/a)"), "See *this* <https://example.com/a|clip>");
});

test("each crew role has its own installable Slack app", () => {
  const apps = crewManifests();
  assert.deepEqual(
    apps.map((app) => app.manifest.features.bot_user.display_name),
    ["Maestro", "Scout", "Scribe", "Pixel", "Cutter", "Gatekeeper"],
  );
  for (const { manifest } of apps) {
    assert.equal(manifest.settings.socket_mode_enabled, true);
    assert.ok(manifest.oauth_config.scopes.bot.includes("chat:write"));
    assert.ok(manifest.oauth_config.scopes.bot.includes("chat:write.customize"));
    const url = createAppUrl(manifest);
    assert.ok(url.startsWith("https://api.slack.com/apps?new_app=1&manifest_json="));
    assert.match(decodeURIComponent(url), new RegExp(manifest.display_information.name));
  }
});
