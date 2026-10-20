// Rate-limited, robots.txt-aware HTTP client for crawling the source directory.

export type FetcherOptions = {
  userAgent: string;
  minIntervalMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export class RobotsDisallowedError extends Error {}

export class PoliteFetcher {
  private readonly opts: Required<FetcherOptions>;
  private lastRequestAt = Number.NEGATIVE_INFINITY;
  private queue: Promise<unknown> = Promise.resolve();
  private robots = new Map<string, Promise<RobotsRules>>();

  constructor(opts: FetcherOptions) {
    this.opts = {
      minIntervalMs: 1000,
      retries: 3,
      fetchImpl: fetch,
      now: () => Date.now(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      ...opts,
    };
  }

  /** GET a URL as text. Requests are serialized and spaced at least `minIntervalMs` apart. */
  async getText(url: string, init?: RequestInit): Promise<string> {
    const target = new URL(url);
    const rules = await this.rulesFor(target.origin);
    if (!rules.allows(target.pathname + target.search)) {
      throw new RobotsDisallowedError(`robots.txt disallows ${url}`);
    }
    const res = await this.request(url, init);
    if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${url} → ${res.status}`);
    return res.text();
  }

  private rulesFor(origin: string): Promise<RobotsRules> {
    let rules = this.robots.get(origin);
    if (!rules) {
      rules = this.request(`${origin}/robots.txt`).then(async (res) => parseRobots(res.ok ? await res.text() : ""));
      this.robots.set(origin, rules);
    }
    return rules;
  }

  private request(url: string, init?: RequestInit): Promise<Response> {
    const run = async () => {
      for (let attempt = 0; ; attempt++) {
        const wait = this.lastRequestAt + this.opts.minIntervalMs - this.opts.now();
        if (wait > 0) await this.opts.sleep(wait);
        this.lastRequestAt = this.opts.now();
        try {
          const res = await this.opts.fetchImpl(url, {
            ...init,
            headers: { "User-Agent": this.opts.userAgent, ...init?.headers },
          });
          if ((res.status === 429 || res.status >= 500) && attempt < this.opts.retries) {
            await this.opts.sleep(backoff(attempt));
            continue;
          }
          return res;
        } catch (err) {
          if (attempt >= this.opts.retries) throw err;
          await this.opts.sleep(backoff(attempt));
        }
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}

const backoff = (attempt: number) => 2000 * 2 ** attempt;

type RobotsRules = { allows(path: string): boolean };

/** Minimal robots.txt support: `User-agent: *` groups, Allow/Disallow with `*` and `$`, longest match wins. */
export function parseRobots(txt: string): RobotsRules {
  const rules: { allow: boolean; pattern: RegExp; length: number }[] = [];
  let applies = false;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    const k = key.toLowerCase();
    if (k === "user-agent") {
      applies = lastWasAgent ? applies || value === "*" : value === "*";
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!applies || (k !== "allow" && k !== "disallow") || !value) continue;
    const source = value
      .split("")
      .map((ch, i) => (ch === "*" ? ".*" : ch === "$" && i === value.length - 1 ? "$" : ch.replace(/[.+?^{}()|[\]\\]/g, "\\$&")))
      .join("");
    rules.push({ allow: k === "allow", pattern: new RegExp(`^${source}`), length: value.length });
  }
  return {
    allows(path) {
      let best: (typeof rules)[number] | undefined;
      for (const r of rules) {
        if (r.pattern.test(path) && (!best || r.length > best.length || (r.length === best.length && r.allow))) best = r;
      }
      return best ? best.allow : true;
    },
  };
}
