import { addMonths, format, subMonths } from "date-fns";

const TEAM_SOURCES = {
  MANCHESTER_UNITED: {
    teamId: "360",
    displayName: "Manchester United",
    endpoints: [
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/360/schedule",
    ],
    detailsEndpoint: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/360",
  },
  LEEDS_UNITED: {
    teamId: "357",
    displayName: "Leeds United",
    endpoints: [
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/357/schedule",
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.2/teams/357/schedule",
    ],
    detailsEndpoint: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/357",
  },
};

const DEFAULT_RANGE_MONTHS_AHEAD = 6;
const DEFAULT_RANGE_MONTHS_BEHIND = 1;

function buildWindow() {
  const now = new Date();
  const earliest = subMonths(now, DEFAULT_RANGE_MONTHS_BEHIND);
  const latest = addMonths(now, DEFAULT_RANGE_MONTHS_AHEAD);
  return { earliest, latest };
}

function isWithinDefaultWindow(date) {
  if (!date || Number.isNaN(date.getTime())) {
    return false;
  }
  const { earliest, latest } = buildWindow();
  return date >= earliest && date <= latest;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "FixtureFusion/1.0 (+github.com)",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`${url} -> ${response.status}`);
  }
  return response.json();
}

function describeEvent(event, teamId, teamName) {
  const competition = event.competitions?.[0];
  const rawDate = competition?.date ?? event.date;
  const start = rawDate ? new Date(rawDate) : null;
  const competitors = competition?.competitors ?? [];
  const focus = competitors.find((item) => item.team?.id === teamId);
  const opponent = competitors.find((item) => item.team?.id && item.team.id !== teamId);
  const opponentName = opponent?.team?.displayName ?? "TBD";
  const qualifier = focus?.homeAway === "home" ? "vs" : focus?.homeAway === "away" ? "@" : "vs";
  return {
    rawDate,
    parsedDate: start?.toISOString(),
    withinWindow: start ? isWithinDefaultWindow(start) : false,
    title: `${teamName} ${qualifier} ${opponentName}`,
    status: competition?.status?.type?.detail,
  };
}

async function inspectTeam(key) {
  const config = TEAM_SOURCES[key];
  for (const endpoint of config.endpoints) {
    try {
      const data = await fetchJson(endpoint);
      const events = data.events ?? [];
      console.log(`\nSource: ${key}, endpoint: ${endpoint}, keys: ${Object.keys(data).join(",")}`);
      if (data.nextEvent) {
        console.log("nextEvent", data.nextEvent);
      }
      if (data.previousEvent) {
        console.log("previousEvent", data.previousEvent);
      }
      console.log(`events: ${events.length}`);
      const descriptions = events.slice(0, 5).map((event) => describeEvent(event, config.teamId, config.displayName));
      for (const info of descriptions) {
        console.log(info);
      }
      const upcoming = events
        .map((event) => describeEvent(event, config.teamId, config.displayName))
        .filter((info) => info.withinWindow && info.parsedDate && new Date(info.parsedDate) >= new Date())
        .slice(0, 5);
      console.log(`Upcoming within window (${upcoming.length}):`);
      for (const info of upcoming) {
        console.log(info.parsedDate, info.title, info.status);
      }
    } catch (error) {
      console.error(`Error for ${key} ${endpoint}`, error);
    }
  }

  if (config.detailsEndpoint) {
    const details = await fetchJson(config.detailsEndpoint);
    const nextEvents = details?.team?.nextEvent ?? [];
    console.log(`nextEvent length: ${nextEvents.length}`);
    for (const entry of nextEvents) {
      console.log("detail next", entry.date, entry.name, entry.status?.type?.detail);
    }
  }
}

async function main() {
  await inspectTeam("MANCHESTER_UNITED");
  await inspectTeam("LEEDS_UNITED");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
