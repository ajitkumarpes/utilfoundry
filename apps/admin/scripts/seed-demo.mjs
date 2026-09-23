// Fills a LOCAL database with realistic demo data: 90 days of visits and a spread of
// feedback, so the dashboard can be developed and tested against something that looks
// like production. Refuses to run against production, and refuses a non-local database.
//
//   node --env-file=.env.local scripts/seed-demo.mjs [--reset]

import { randomUUID } from "node:crypto";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "";
if (process.env.NODE_ENV === "production" || !/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error("seed-demo only runs against a local database (DATABASE_URL on localhost), never in production.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const DAY = 86_400_000;
const pick = (items, weights) => {
  let roll = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < items.length; index += 1) if ((roll -= weights[index]) <= 0) return items[index];
  return items[items.length - 1];
};

const COUNTRIES = [["IN", "MH", "Mumbai"], ["US", "CA", "San Francisco"], ["GB", "ENG", "London"], ["DE", "BE", "Berlin"], ["BR", "SP", "São Paulo"], ["CA", "ON", "Toronto"], ["AU", "NSW", "Sydney"], ["FR", "IDF", "Paris"], ["JP", "13", "Tokyo"], ["NL", "NH", "Amsterdam"]];
const COUNTRY_WEIGHTS = [30, 22, 11, 8, 6, 5, 4, 4, 3, 3];
const PAGES = {
  developer: ["/json-formatter", "/base64-encoder", "/jwt-decoder", "/regex-tester", "/sql-formatter", "/tools", "/uuid-generator"],
  images: ["/image-compressor", "/resize-image", "/convert-image", "/"],
  pdf: ["/tools/merge-pdf", "/tools/compress-pdf", "/tools/split-pdf", "/"],
  web: ["/", "/privacy"]
};
const APP_WEIGHTS = [45, 25, 20, 10];
const AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0",
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"
];
const REFERRERS = [null, null, null, "google.com", "github.com", "bing.com", "news.ycombinator.com", "reddit.com", "duckduckgo.com"];

async function main() {
  if (process.argv.includes("--reset")) await sql`TRUNCATE visits, feedback`;
  const now = Date.now();
  const visitors = Array.from({ length: 900 }, () => randomUUID());
  const visits = [];
  for (let day = 0; day < 90; day += 1) {
    // Gentle growth with a weekday rhythm, so the charts have a shape.
    const weekday = new Date(now - day * DAY).getUTCDay();
    const volume = Math.round((60 - day * 0.35) * (weekday === 0 || weekday === 6 ? 0.6 : 1) * (0.8 + Math.random() * 0.4));
    for (let index = 0; index < volume; index += 1) {
      const app = pick(["developer", "images", "pdf", "web"], APP_WEIGHTS);
      const [country, region, city] = pick(COUNTRIES, COUNTRY_WEIGHTS);
      visits.push({
        id: randomUUID(),
        app,
        path: pick(PAGES[app], PAGES[app].map((_, rank) => PAGES[app].length - rank)),
        visitor_id: visitors[Math.floor(Math.random() * visitors.length)],
        country: Math.random() < 0.04 ? null : country,
        region,
        city,
        referrer: REFERRERS[Math.floor(Math.random() * REFERRERS.length)],
        user_agent: pick(AGENTS, [34, 18, 20, 8, 14, 6]),
        created_at: new Date(now - day * DAY - Math.random() * DAY)
      });
    }
  }
  for (let start = 0; start < visits.length; start += 2000) await sql`INSERT INTO visits ${sql(visits.slice(start, start + 2000))}`;

  const MESSAGES = [
    ["issue", 2, "developer", "json", "JSON Formatter", "Pasting a 5 MB file freezes the tab for a few seconds."],
    ["feature_request", 4, "developer", "jwt", "JWT Decoder", "Could it show when the token expires in my local time?"],
    ["thanks", 5, "developer", "json", "JSON Formatter", "The jump-to-error button saved me an hour today. Thank you!"],
    ["general", 4, "images", "image-compressor", "Image Compressor", "Works well. A batch download as ZIP would be handy."],
    ["issue", 1, "pdf", null, "Merge PDF", "Merging two scanned PDFs lost the page order."],
    ["feature_request", null, "developer", "regex", "Regex Tester", "Please add named group highlighting."],
    ["thanks", 5, "web", null, null, null],
    ["general", 3, "developer", "sql", "SQL Formatter", "Keyword case option (lower/upper) would be nice."],
    ["issue", 2, "images", "resize-image", "Resize Image", "Resizing a PNG with transparency turned the background black."],
    ["feature_request", 5, "pdf", null, "Compress PDF", "Let me choose the target size."],
    ["general", 4, "developer", "base64", "Base64 Encoder", "=HYPERLINK(\"http://example.com\") should not run in the CSV export"],
    ["thanks", 4, "developer", "uuid", "UUID Generator", "Simple and fast."]
  ];
  const feedback = [];
  for (let index = 0; index < 48; index += 1) {
    const [category, rating, app, toolId, toolName, message] = MESSAGES[index % MESSAGES.length];
    feedback.push({
      id: randomUUID(),
      app,
      tool_id: toolId,
      tool_name: toolName,
      category,
      rating,
      message,
      page_url: `https://${app === "web" ? "" : `${app === "developer" ? "dev" : app}.`}utilfoundry.com/${toolId ?? ""}`,
      user_agent: AGENTS[index % AGENTS.length],
      status: index % 3 === 0 ? "reviewed" : "new",
      created_at: new Date(now - index * 0.9 * DAY - Math.random() * DAY / 2)
    });
  }
  await sql`INSERT INTO feedback ${sql(feedback)}`;
  console.log(`Seeded ${visits.length} visits and ${feedback.length} feedback items.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => sql.end());
