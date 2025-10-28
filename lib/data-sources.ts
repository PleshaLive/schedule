import { addMonths, format, subMonths } from "date-fns";
import { HTMLElement, parse as parseHtml } from "node-html-parser";
import { CalendarEventWithMeta, CalendarOutcome } from "@/types/events";

const REVALIDATE_SECONDS = 60 * 60; // 1 hour cache window
const DEFAULT_RANGE_MONTHS_AHEAD = 6;
const DEFAULT_RANGE_MONTHS_BEHIND = 1;
const LEGACY_RANGE_MONTHS_AHEAD = 18;
const LEGACY_RANGE_MONTHS_BEHIND = 3;

const TEAM_SOURCES = {
  MANCHESTER_UNITED: {
    teamId: "360",
    displayName: "Manchester United",
    endpoints: [
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/360/schedule",
    ],
    scoreboardEndpoints: [
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard",
    ],
  },
  LEEDS_UNITED: {
    teamId: "357",
    displayName: "Leeds United",
    endpoints: [
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/357/schedule",
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.2/teams/357/schedule",
    ],
    scoreboardEndpoints: [
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard",
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.2/scoreboard",
    ],
  },
} as const;

const UFC_SCOREBOARD_ENDPOINT = "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard";
const LIQUIPEDIA_ENDPOINT = "https://liquipedia.net/counterstrike/api.php";

type RawTeamSchedule = {
  events?: Array<{
    id?: string;
    date?: string;
    name?: string;
    shortName?: string;
    seasonType?: { name?: string };
    season?: { displayName?: string };
    competitions?: Array<{
      date?: string;
      venue?: {
        fullName?: string;
        address?: { city?: string; country?: string };
      };
      competitors?: Array<{
        id?: string;
        homeAway?: "home" | "away";
        team?: {
          id?: string;
          displayName?: string;
          shortDisplayName?: string;
          abbreviation?: string;
        };
        score?: string;
      }>;
      status?: {
        type?: {
          state?: string;
          detail?: string;
          description?: string;
        };
      };
    }>;
    league?: { name?: string; shortName?: string };
  }>;
};

type RawUfcScoreboard = {
  events?: Array<{
    id?: string;
    date?: string;
    name?: string;
    shortName?: string;
    competitions?: Array<{
      id?: string;
      date?: string;
      matchNumber?: number;
      cardSegment?: { name?: string };
      type?: { text?: string; abbreviation?: string };
      competitors?: Array<{
        athlete?: { displayName?: string };
      }>; 
    }>;
  }>;
};

type RawSoccerScoreboard = {
  events?: RawTeamSchedule["events"];
};

type LiquipediaParseResponse = {
  parse?: {
    text?: {
      "*"?: string;
    };
  };
};

async function fetchJson<T>(url: string): Promise<T> {
  const requestInit = {
    headers: {
      "User-Agent": "FixtureFusion/1.0 (+github.com)",
      Accept: "application/json",
    },
    next: { revalidate: REVALIDATE_SECONDS },
  } satisfies RequestInit & { next: { revalidate: number } };

  const response = await fetch(url, requestInit);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function buildUfcScoreboardUrl(): string {
  const now = new Date();
  const earliest = subMonths(now, DEFAULT_RANGE_MONTHS_BEHIND);
  const latest = addMonths(now, DEFAULT_RANGE_MONTHS_AHEAD);
  const params = new URLSearchParams({
    limit: "50",
    dates: `${format(earliest, "yyyyMMdd")}-${format(latest, "yyyyMMdd")}`,
  });

  return `${UFC_SCOREBOARD_ENDPOINT}?${params.toString()}`;
}

function buildSoccerScoreboardUrl(endpoint: string): string {
  const now = new Date();
  const earliest = subMonths(now, DEFAULT_RANGE_MONTHS_BEHIND);
  const latest = addMonths(now, DEFAULT_RANGE_MONTHS_AHEAD);
  const params = new URLSearchParams({
    limit: "200",
    dates: `${format(earliest, "yyyyMMdd")}-${format(latest, "yyyyMMdd")}`,
  });

  return `${endpoint}?${params.toString()}`;
}

function isWithinWindow(
  dateISO: string,
  monthsAhead: number,
  monthsBehind: number = DEFAULT_RANGE_MONTHS_BEHIND,
): boolean {
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  const earliest = subMonths(now, monthsBehind);
  const latest = addMonths(now, monthsAhead);

  return date >= earliest && date <= latest;
}

function isWithinDefaultWindow(dateISO: string): boolean {
  return isWithinWindow(dateISO, DEFAULT_RANGE_MONTHS_AHEAD, DEFAULT_RANGE_MONTHS_BEHIND);
}

function toISO(dateString?: string): string | null {
  if (!dateString) return null;
  const parsed = new Date(dateString);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildLocation(venue?: { fullName?: string; address?: { city?: string; country?: string } }): string | undefined {
  if (!venue) return undefined;
  const pieces = [venue.fullName, venue.address?.city, venue.address?.country].filter(Boolean);
  return pieces.length ? pieces.join(", ") : undefined;
}

function extractNumericScore(value?: string | null): number | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  const match = value.match(/-?\d+/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[0] ?? "", 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatMatchup(
  ourTeam: { id: string; displayName: string },
  competitors: Array<{
    homeAway?: "home" | "away";
    team?: { displayName?: string; id?: string };
  }> ,
): { title: string; subtitle?: string } {
  const focus = competitors.find((competitor) => competitor.team?.id === ourTeam.id);
  const opponent = competitors.find((competitor) => competitor.team?.id && competitor.team.id !== ourTeam.id);

  const opponentName = opponent?.team?.displayName ?? "TBD";
  const qualifier = focus?.homeAway === "home" ? "vs" : focus?.homeAway === "away" ? "@" : "vs";

  return {
    title: `${ourTeam.displayName} ${qualifier} ${opponentName}`.trim(),
    subtitle: opponentName,
  };
}

function normalizeTeamEvents(
  events: RawTeamSchedule["events"],
  source: TeamSourceKey,
): CalendarEventWithMeta[] {
  const config = TEAM_SOURCES[source];
  const eventList = events ?? [];

  const normalized: CalendarEventWithMeta[] = [];

  for (const event of eventList) {
    const competition = event.competitions?.[0];
    const startTime = toISO(competition?.date ?? event.date);
  if (!startTime || !isWithinDefaultWindow(startTime)) {
      continue;
    }

    const competitors = (competition?.competitors ?? []) as Array<{
      homeAway?: "home" | "away";
      team?: { displayName?: string; id?: string };
      score?: string;
    }>;

    const focusCompetitor = competitors.find((competitor) => competitor.team?.id === config.teamId);
    const opponentCompetitor = competitors.find(
      (competitor) => competitor.team?.id && competitor.team.id !== config.teamId,
    );

    const matchup = formatMatchup(
      { id: config.teamId, displayName: config.displayName },
      competitors,
    );

    const state = competition?.status?.type?.state;
    const statusDetail = competition?.status?.type?.detail;
    const statusDescription = competition?.status?.type?.description;

    let result: string | undefined;
    let outcome: CalendarOutcome | undefined;
    if (state === "post") {
      const focusScore = focusCompetitor?.score;
      const opponentScore = opponentCompetitor?.score;

      if (focusScore && opponentScore) {
        result = `${focusScore} - ${opponentScore}`;
        const focusNumeric = extractNumericScore(focusScore);
        const opponentNumeric = extractNumericScore(opponentScore);
        if (focusNumeric !== null && opponentNumeric !== null) {
          if (focusNumeric > opponentNumeric) {
            outcome = "WIN";
          } else if (focusNumeric < opponentNumeric) {
            outcome = "LOSS";
          } else {
            outcome = "DRAW";
          }
        }
      } else if (statusDetail) {
        result = statusDetail;
      } else if (statusDescription) {
        result = statusDescription;
      }
    }

    normalized.push({
      id: `${source}-${event.id ?? startTime}`,
      source,
      title: matchup.title,
      competition: event.league?.shortName ?? event.seasonType?.name ?? event.season?.displayName,
      startTimeUTC: startTime,
      venue: competition?.venue?.fullName,
      location: buildLocation(competition?.venue),
      status: statusDetail ?? statusDescription,
      subtitle: matchup.subtitle,
      result,
      outcome,
    });
  }

  return normalized;
}

function pickMainUfcCompetition(
  competitions: NonNullable<RawUfcScoreboard["events"]>[number]["competitions"],
) {
  if (!competitions || competitions.length === 0) return undefined;

  const mainCandidates = competitions.filter((competition) => competition.cardSegment?.name === "main");
  const pool = mainCandidates.length ? mainCandidates : competitions;

  return pool.reduce((best, current) => {
    if (!best) return current;
    const bestRank = (best.matchNumber ?? 100);
    const currentRank = (current.matchNumber ?? 100);
    return currentRank < bestRank ? current : best;
  });
}

function normalizeUfcEvents(data: RawUfcScoreboard): CalendarEventWithMeta[] {
  const events = data.events ?? [];
  const seen = new Set<string>();

  const normalized: CalendarEventWithMeta[] = [];

  for (const event of events) {
    if (!event.id || seen.has(event.id)) {
      continue;
    }
    seen.add(event.id);

    const competition = pickMainUfcCompetition(event.competitions);
    const startTime = toISO(event.date ?? competition?.date);
  if (!startTime || !isWithinDefaultWindow(startTime)) {
      continue;
    }

    const fighterNames = (competition?.competitors ?? [])
      .map((competitor) => competitor.athlete?.displayName)
      .filter(Boolean)
      .join(" vs ");

    normalized.push({
      id: `UFC-${event.id}`,
      source: "UFC",
      title: event.name ?? competition?.type?.text ?? "UFC Event",
      competition: competition?.type?.text ?? competition?.type?.abbreviation,
      fighters: fighterNames || undefined,
      startTimeUTC: startTime,
    });
  }

  return normalized;
}

type TeamSourceKey = keyof typeof TEAM_SOURCES;

async function fetchTeamSchedule(source: TeamSourceKey): Promise<RawTeamSchedule | null> {
  const { endpoints } = TEAM_SOURCES[source];
  let lastError: unknown;

  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    try {
      const data = await fetchJson<RawTeamSchedule>(endpoint);
      const hasEvents = (data.events?.length ?? 0) > 0;
      if (!hasEvents && index < endpoints.length - 1) {
        continue;
      }
      return data;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

async function fetchTeamScoreboardEvents(source: TeamSourceKey): Promise<RawTeamSchedule["events"]> {
  const { teamId, scoreboardEndpoints } = TEAM_SOURCES[source];
  if (!scoreboardEndpoints?.length) {
    return [];
  }

  const aggregated: NonNullable<RawTeamSchedule["events"]> = [];
  let lastError: unknown;

  for (const endpoint of scoreboardEndpoints) {
    try {
      const data = await fetchJson<RawSoccerScoreboard>(buildSoccerScoreboardUrl(endpoint));
      const events = data.events ?? [];

      for (const event of events) {
        const competition = event.competitions?.[0];
        const competitors = (competition?.competitors ?? []) as Array<{
          team?: { id?: string };
        }>;

        const matchesTeam = competitors.some((competitor) => competitor.team?.id === teamId);
        if (matchesTeam) {
          aggregated.push(event);
        }
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (aggregated.length === 0 && lastError) {
    throw lastError;
  }

  return aggregated;
}

function mergeAndSortEvents(...sources: CalendarEventWithMeta[][]): CalendarEventWithMeta[] {
  const deduped = new Map<string, CalendarEventWithMeta>();

  for (const list of sources) {
    for (const event of list) {
      deduped.set(event.id, event);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => {
    const aTime = new Date(a.startTimeUTC).getTime();
    const bTime = new Date(b.startTimeUTC).getTime();
    return aTime - bTime;
  });
}

export async function fetchManchesterUnitedEvents(): Promise<CalendarEventWithMeta[]> {
  const [schedule, scoreboardEvents] = await Promise.all([
    fetchTeamSchedule("MANCHESTER_UNITED"),
    fetchTeamScoreboardEvents("MANCHESTER_UNITED"),
  ]);

  const normalizedSchedule = normalizeTeamEvents(schedule?.events ?? [], "MANCHESTER_UNITED");
  const normalizedScoreboard = normalizeTeamEvents(scoreboardEvents, "MANCHESTER_UNITED");

  return mergeAndSortEvents(normalizedSchedule, normalizedScoreboard);
}

export async function fetchLeedsUnitedEvents(): Promise<CalendarEventWithMeta[]> {
  const [schedule, scoreboardEvents] = await Promise.all([
    fetchTeamSchedule("LEEDS_UNITED"),
    fetchTeamScoreboardEvents("LEEDS_UNITED"),
  ]);

  const normalizedSchedule = normalizeTeamEvents(schedule?.events ?? [], "LEEDS_UNITED");
  const normalizedScoreboard = normalizeTeamEvents(scoreboardEvents, "LEEDS_UNITED");

  return mergeAndSortEvents(normalizedSchedule, normalizedScoreboard);
}

export async function fetchUfcEvents(): Promise<CalendarEventWithMeta[]> {
  const data = await fetchJson<RawUfcScoreboard>(buildUfcScoreboardUrl());
  return normalizeUfcEvents(data);
}

function cleanText(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length ? trimmed : undefined;
}

function buildLiquipediaUrl(): string {
  const params = new URLSearchParams({
    action: "parse",
    page: "Legacy",
    prop: "text",
    format: "json",
    origin: "*",
  });

  return `${LIQUIPEDIA_ENDPOINT}?${params.toString()}`;
}

function normalizeLegacyCs2Matches(html: string): CalendarEventWithMeta[] {
  const root = parseHtml(html);
  const rows = root
    .querySelectorAll("tr")
    .filter((row): row is HTMLElement => typeof (row as HTMLElement).getAttribute === "function")
    .filter((row) => {
      const classAttr = row.getAttribute("class");
      if (!classAttr) {
        return false;
      }
      const classes = classAttr.split(/\s+/);
      return classes.some((className) =>
        className.startsWith("recent-matches") ||
        className.startsWith("upcoming-matches") ||
        className.startsWith("upcoming-match") ||
        className === "match-row",
      );
    });

  const events: CalendarEventWithMeta[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const rowClassAttr = row.getAttribute("class") ?? "";
    const rowClasses = rowClassAttr.split(/\s+/).filter(Boolean);

    const timestampAttr = row.querySelector('[data-timestamp]')?.getAttribute("data-timestamp");
    const timestamp = timestampAttr ? Number.parseInt(timestampAttr, 10) : Number.NaN;
    const startTimeUTC = Number.isNaN(timestamp)
      ? null
      : new Date(timestamp * 1000).toISOString();

    if (!startTimeUTC || !isWithinWindow(startTimeUTC, LEGACY_RANGE_MONTHS_AHEAD, LEGACY_RANGE_MONTHS_BEHIND)) {
      continue;
    }

    const cells = row.querySelectorAll("td");
    if (cells.length < 7) {
      continue;
    }

    const tierText = cleanText(cells[1]?.textContent ?? undefined);
    const typeText = cleanText(cells[2]?.textContent ?? undefined);

    const tournamentCell = cells[5];
    const tournamentLink = tournamentCell?.querySelector("a");
    const competition = cleanText(tournamentLink?.textContent ?? tournamentCell?.textContent ?? undefined);
    const tournamentHref = tournamentLink?.getAttribute("href") ?? undefined;
    const url = tournamentHref ? new URL(tournamentHref, "https://liquipedia.net").toString() : undefined;

    const scoreText = cleanText(cells[6]?.textContent ?? undefined);
    const opponentText = cleanText(cells[7]?.textContent ?? undefined);

    const statusParts = [tierText, typeText].filter(Boolean);
    const status = statusParts.length ? statusParts.join(" · ") : undefined;

    const id = `LEGACY_CS2-${timestampAttr ?? `${competition ?? "match"}-${opponentText ?? "opponent"}`}`;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);

    const title = opponentText ? `Legacy vs ${opponentText}` : competition ?? "Legacy match";
    const subtitleParts = [opponentText, competition].filter(Boolean);
    const subtitle = subtitleParts.length ? subtitleParts.join(" · ") : undefined;

  const hasNumericScore = scoreText ? /\d/.test(scoreText) : false;
  const result = hasNumericScore ? scoreText : undefined;
    let outcome: CalendarOutcome | undefined;
    if (rowClasses.some((className) => className.includes("bg-win"))) {
      outcome = "WIN";
    } else if (rowClasses.some((className) => className.includes("bg-lose"))) {
      outcome = "LOSS";
    } else if (rowClasses.some((className) => className.includes("bg-draw") || className.includes("bg-tie"))) {
      outcome = "DRAW";
    }

    events.push({
      id,
      source: "LEGACY_CS2",
      title,
      competition: competition ?? undefined,
      startTimeUTC,
      result,
      status,
      subtitle,
      url,
      outcome,
    });
  }

  return events;
}

export async function fetchLegacyCs2Events(): Promise<CalendarEventWithMeta[]> {
  const data = await fetchJson<LiquipediaParseResponse>(buildLiquipediaUrl());
  const html = data.parse?.text?.["*"];
  if (!html) {
    return [];
  }

  return normalizeLegacyCs2Matches(html);
}
