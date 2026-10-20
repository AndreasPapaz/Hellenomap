import { describe, expect, it } from "vitest";
import { parseRobots, PoliteFetcher, RobotsDisallowedError } from "./fetcher";

const ROBOTS = `User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php
Disallow: /*?add-to-cart=
`;

function fakeClock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => void (t += ms) };
}

function fakeFetch(clock: { now: () => number }, responses: Record<string, number[]> = {}) {
  const calls: { url: string; at: number; ua: string | null }[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, at: clock.now(), ua: new Headers(init?.headers).get("User-Agent") });
    if (url.endsWith("/robots.txt")) return new Response(ROBOTS);
    const status = responses[url]?.shift() ?? 200;
    return new Response(`body of ${url}`, { status });
  }) as typeof fetch;
  return { impl, calls };
}

describe("PoliteFetcher", () => {
  it("spaces requests at least minIntervalMs apart and sends the user agent", async () => {
    const clock = fakeClock();
    const { impl, calls } = fakeFetch(clock);
    const f = new PoliteFetcher({ userAgent: "TestBot/1.0", fetchImpl: impl, ...clock });

    await Promise.all(Array.from({ length: 5 }, (_, i) => f.getText(`https://example.com/listing/${i}/`)));

    expect(calls).toHaveLength(6); // robots + 5 pages
    for (let i = 1; i < calls.length; i++) expect(calls[i].at - calls[i - 1].at).toBeGreaterThanOrEqual(1000);
    expect(calls.every((c) => c.ua === "TestBot/1.0")).toBe(true);
  });

  it("refuses URLs disallowed by robots.txt", async () => {
    const clock = fakeClock();
    const { impl } = fakeFetch(clock);
    const f = new PoliteFetcher({ userAgent: "TestBot/1.0", fetchImpl: impl, ...clock });
    await expect(f.getText("https://example.com/wp-admin/options.php")).rejects.toBeInstanceOf(RobotsDisallowedError);
  });

  it("retries 5xx responses with backoff, then succeeds", async () => {
    const clock = fakeClock();
    const url = "https://example.com/listing/flaky/";
    const { impl, calls } = fakeFetch(clock, { [url]: [503, 503] });
    const f = new PoliteFetcher({ userAgent: "TestBot/1.0", fetchImpl: impl, ...clock });
    await expect(f.getText(url)).resolves.toBe(`body of ${url}`);
    expect(calls.filter((c) => c.url === url)).toHaveLength(3);
  });

  it("throws after exhausting retries", async () => {
    const clock = fakeClock();
    const url = "https://example.com/listing/down/";
    const { impl } = fakeFetch(clock, { [url]: [500, 500, 500, 500] });
    const f = new PoliteFetcher({ userAgent: "TestBot/1.0", fetchImpl: impl, ...clock });
    await expect(f.getText(url)).rejects.toThrow("500");
  });
});

describe("parseRobots", () => {
  const rules = parseRobots(ROBOTS);
  it.each([
    ["/listing/agora-market/", true],
    ["/wp-admin/", false],
    ["/wp-admin/admin-ajax.php", true],
    ["/shop/?add-to-cart=5", false],
    ["/jm-ajax/get_listings/", true],
  ])("%s → %s", (p, allowed) => expect(rules.allows(p)).toBe(allowed));
});
