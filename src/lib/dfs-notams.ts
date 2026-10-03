import type { NotamItem } from "./notams";
import { DFS_BRIEFING_URL } from "./dfs-notams-constants";

export { DFS_BRIEFING_URL };

// NOTAM fetcher for ais.dfs.de's "PilotService" portal — server-only (used
// from src/app/api/notams/route.ts, which only exists in "hosted mode";
// see next.config.ts). Never import this from client components.
//
// Confirmed by testing: this requires a logged-in session (an anonymous
// POST to the briefing form gets redirected to /user/login/login_edit.jsp).
// Self-registration is free and open (no pilot license required) at
// https://ais.dfs.de/pilotservice/user/register/register_edit.jsp — see the
// README for how to set DFS_USERNAME/DFS_PASSWORD for hosted mode. Before
// relying on this for real flight prep, check DFS's "Nutzungsbedingungen"
// (terms of use) accepted at login for anything about automated/scripted
// access.
//
// There's no JSON API: this replicates the same form POST the browser does
// (login_submit.jsp -> notam_submit.jsp -> notam_confirmation.jsp) and
// parses the resulting HTML. If DFS changes that HTML, `parseNotamTables`
// below is the only place that needs updating.
const BASE = "https://ais.dfs.de/pilotservice";
const USER_AGENT = "Mozilla/5.0 (compatible; FlightPrep/1.0)";

export interface NotamFetchResult {
  icao: string;
  fetchedAt: string;
  source: string;
  briefingUrl: string;
  notams: NotamItem[];
  error: string | null;
}

type CookieJar = Record<string, string>;

function mergeSetCookies(jar: CookieJar, res: Response): CookieJar {
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const raw of setCookie) {
    const pair = raw.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq > 0) jar[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return jar;
}

function cookieHeader(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function login(jar: CookieJar, username: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/user/login/login_submit.jsp`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(jar),
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({ account: username, pass: password }).toString(),
  });
  mergeSetCookies(jar, res);
}

function buildNotamForm(icao: string, dof: string): URLSearchParams {
  const id = crypto.randomUUID();
  const p = new URLSearchParams();
  p.set("id", id);
  p.set("LOAD_TEMPLATE", id);
  p.set("AIRCRAFT_IDENTIFICATION", "");
  p.set("DEPARTURE_SEARCH", icao);
  p.set("DEPARTURE", icao);
  p.set("DEPARTURE_RAW", icao);
  p.set("DESTINATION_SEARCH", icao);
  p.set("DESTINATION", icao);
  p.set("DESTINATION_RAW", icao);
  p.set("AERODROME_ONLY", "AERODROME");
  p.set("OI_DOF", dof);
  p.set("NOTAM_RULES", "V");
  p.set("FILTER_DAY", "All");
  return p;
}

async function submitAndFetchBriefing(jar: CookieJar, icao: string): Promise<string> {
  const dof = new Date().toISOString().slice(0, 10);

  const submitRes = await fetch(`${BASE}/briefing/notam/notam_submit.jsp`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(jar),
      "User-Agent": USER_AGENT,
    },
    body: buildNotamForm(icao, dof).toString(),
  });
  mergeSetCookies(jar, submitRes);

  const location = submitRes.headers.get("location") ?? "";
  if (location.includes("/user/login/")) {
    throw new Error("DFS session wasn't authenticated (redirected to login) — check DFS_USERNAME/DFS_PASSWORD.");
  }
  if (submitRes.status < 300 || submitRes.status >= 400) {
    throw new Error(`Unexpected response from notam_submit.jsp: HTTP ${submitRes.status}`);
  }

  const confRes = await fetch(`${BASE}/briefing/notam/notam_confirmation.jsp`, {
    headers: { Cookie: cookieHeader(jar), "User-Agent": USER_AGENT },
  });
  mergeSetCookies(jar, confRes);
  const html = await confRes.text();

  if (html.includes('name="account"') || html.includes('id="pass"')) {
    throw new Error("Landed on the login page instead of a briefing — DFS session was not authenticated.");
  }

  return html;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&auml;/g, "ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&szlig;/g, "ß")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""))
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

/** Parses each `<table class="notam">` block from the briefing confirmation HTML. */
export function parseNotamTables(html: string): NotamItem[] {
  const notams: NotamItem[] = [];
  const tableRe = /<table class="notam"[^>]*>([\s\S]*?)<\/table>/g;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(html))) {
    const block = m[1];
    const numberMatch = block.match(/<th class="number">([^<]*)<\/th>/);
    const nameMatch = block.match(/<th class="name">([\s\S]*?)<\/th>/);
    const validityMatch = block.match(/<tr class="validity">([\s\S]*?)<\/tr>/);
    const times = validityMatch ? [...validityMatch[1].matchAll(/datetime="([^"]+)"/g)].map((t) => t[1]) : [];

    const itemRe = /<tr class="item">([\s\S]*?)<\/tr>/g;
    const items: string[] = [];
    let im: RegExpExecArray | null;
    while ((im = itemRe.exec(block))) {
      items.push(stripTags(im[1]));
    }

    notams.push({
      id: (numberMatch?.[1] ?? "").trim() || "NOTAM",
      text: [nameMatch ? stripTags(nameMatch[1]) : "", ...items].filter(Boolean).join("\n"),
      validFrom: times[0],
      validTill: times[1],
    });
  }
  return notams;
}

export async function fetchNotams(icao: string): Promise<NotamFetchResult> {
  const fetchedAt = new Date().toISOString();
  const source = "ais.dfs.de PilotService (DFS NOTAM briefing)";

  const username = process.env.DFS_USERNAME;
  const password = process.env.DFS_PASSWORD;

  if (!username || !password) {
    return {
      icao,
      fetchedAt,
      source,
      briefingUrl: DFS_BRIEFING_URL,
      notams: [],
      error: "DFS_USERNAME / DFS_PASSWORD aren't set on the server — see README's hosted-mode setup.",
    };
  }

  const jar: CookieJar = {};
  try {
    await login(jar, username, password);
    const html = await submitAndFetchBriefing(jar, icao);
    const notams = parseNotamTables(html);
    return { icao, fetchedAt, source, briefingUrl: DFS_BRIEFING_URL, notams, error: null };
  } catch (err) {
    return {
      icao,
      fetchedAt,
      source,
      briefingUrl: DFS_BRIEFING_URL,
      notams: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
