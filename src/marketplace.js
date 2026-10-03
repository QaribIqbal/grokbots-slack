#!/usr/bin/env node
import { pathToFileURL } from "node:url";

const MARKETPLACE = "https://x.ai/bot/marketplace";

export function slugCandidates(query) {
  const raw = String(query || "").trim().toLowerCase();
  const hyphen = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const tight = raw.replace(/[^a-z0-9]+/g, "");
  return [...new Set([hyphen, tight].filter(Boolean))];
}

export function catalogSlugs(html) {
  return [
    ...new Set(
      [...String(html).matchAll(/\/bot\/marketplace\/bots\/([a-z0-9-]+)/g)].map(
        (match) => match[1],
      ),
    ),
  ];
}

export function findSlug(html, query) {
  const slugs = catalogSlugs(html);
  const candidates = slugCandidates(query);
  for (const candidate of candidates) {
    if (slugs.includes(candidate)) return candidate;
  }
  const tight = candidates[0]?.replace(/-/g, "");
  const hits = slugs.filter((slug) => slug.replace(/-/g, "") === tight);
  return hits.length === 1 ? hits[0] : null;
}

const RESERVED_BOT_PATHS = new Set([
  "marketplace",
  "guides",
  "use-cases",
  "download",
  "changelog",
]);

export function parseBotPage(html) {
  const source = String(html);
  const deep = source.match(
    /grokbot:\/\/app\/v1\/bot-template\?id=([A-Za-z0-9_-]+)/,
  );
  const ids = [
    ...source.matchAll(/href="\/bot\/([A-Za-z0-9_-]{8,})"/g),
  ]
    .map((match) => match[1])
    .filter((id) => !RESERVED_BOT_PATHS.has(id));
  const templateId = deep?.[1] || ids[0];
  if (!templateId || RESERVED_BOT_PATHS.has(templateId)) return null;
  return {
    templateId,
    templateUrl: `https://x.ai/bot/${templateId}`,
    appUrl: `grokbot://app/v1/bot-template?id=${templateId}`,
  };
}

export function describeInstall(bot) {
  return {
    ...bot,
    install: "human",
    note: "Open templateUrl on the computer where the Grok Bot app is installed, then choose Add Bot. An agent cannot finish that click.",
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "grokbots-slack" },
  });
  if (!response.ok) {
    throw new Error(`Could not fetch ${url} (${response.status})`);
  }
  return response.text();
}

export async function lookupMarketplaceBot(query, fetchImpl = fetchText) {
  const catalog = await fetchImpl(MARKETPLACE);
  const slug = findSlug(catalog, query);
  if (!slug) {
    throw new Error(`No marketplace bot matches "${query}"`);
  }
  const marketplaceUrl = `${MARKETPLACE}/bots/${slug}`;
  const page = await fetchImpl(marketplaceUrl);
  const install = parseBotPage(page);
  if (!install) {
    throw new Error(`Marketplace page for ${slug} has no Add link`);
  }
  const title = page.match(/<title>([^<]+)<\/title>/)?.[1]?.replace(/ ·.*$/, "").trim();
  return describeInstall({
    name: title || slug,
    slug,
    marketplaceUrl,
    ...install,
  });
}

async function main() {
  const query = process.argv.slice(2).filter((arg) => !arg.startsWith("-")).join(" ");
  if (!query) {
    console.error("Usage: node src/marketplace.js \"Clip Bot\"");
    process.exitCode = 2;
    return;
  }
  const bot = await lookupMarketplaceBot(query);
  console.log(JSON.stringify(bot, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
