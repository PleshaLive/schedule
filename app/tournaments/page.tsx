import Link from "next/link";
import { format } from "date-fns";
import { enUS, ru, uk } from "date-fns/locale";
import { utcToZonedTime } from "date-fns-tz";

import { getCalendarEvents } from "@/lib/events-service";
import { CalendarSource, CalendarEventWithMeta } from "@/types/events";

const KYIV_TZ = "Europe/Kyiv";
const FALLBACK_TOURNAMENT = "Без названия турнира";

const SOURCE_ORDER: CalendarSource[] = ["MANCHESTER_UNITED", "LEEDS_UNITED", "LEGACY_CS2", "UFC"];

const SOURCE_META: Record<CalendarSource, { label: string; tagline: string; accent: string; chip: string }> = {
  MANCHESTER_UNITED: {
    label: "Manchester United",
    tagline: "Календарь турниров красных дьяволов",
    accent: "#F5C400",
    chip: "text-black",
  },
  LEEDS_UNITED: {
    label: "Leeds United",
    tagline: "Белоснежные и их путь в турнирах",
    accent: "#F8FF13",
    chip: "text-black",
  },
  LEGACY_CS2: {
    label: "Legacy CS2",
    tagline: "Бразильский состав на Liquipedia",
    accent: "#00F5D4",
    chip: "text-black",
  },
  UFC: {
    label: "UFC",
    tagline: "Главные ивенты октагона",
    accent: "#FF2A3D",
    chip: "text-white",
  },
};

type TournamentDigest = {
  source: CalendarSource;
  name: string;
  eventCount: number;
  nextDateUTC: string | null;
  lastDateUTC: string | null;
};

function toTournamentKey(event: CalendarEventWithMeta): string {
  const candidate = event.competition?.trim();
  if (candidate && candidate.length > 0) {
    return candidate;
  }

  if (event.source === "UFC" && event.title) {
    return event.title;
  }

  return FALLBACK_TOURNAMENT;
}

function formatKyivDate(value: string | null) {
  if (!value) {
    return null;
  }
  const utcDate = new Date(value);
  if (Number.isNaN(utcDate.getTime())) {
    return null;
  }
  const zoned = utcToZonedTime(utcDate, KYIV_TZ);
  return {
    uk: format(zoned, "d MMMM yyyy, HH:mm", { locale: uk }),
    ru: format(zoned, "d MMMM yyyy, HH:mm", { locale: ru }),
    en: format(zoned, "d MMM yyyy, HH:mm", { locale: enUS }),
  };
}

function buildTournamentDigests(events: CalendarEventWithMeta[]): TournamentDigest[] {
  const now = Date.now();
  const map = new Map<string, TournamentDigest>();

  for (const event of events) {
    const key = `${event.source}|${toTournamentKey(event)}`;
    const entry = map.get(key);
    const start = new Date(event.startTimeUTC).getTime();

    if (!entry) {
      map.set(key, {
        source: event.source,
        name: toTournamentKey(event),
        eventCount: 1,
        nextDateUTC: start >= now ? event.startTimeUTC : null,
        lastDateUTC: event.startTimeUTC,
      });
      continue;
    }

    entry.eventCount += 1;
    entry.lastDateUTC = entry.lastDateUTC && entry.lastDateUTC > event.startTimeUTC ? entry.lastDateUTC : event.startTimeUTC;
    if (start >= now) {
      if (!entry.nextDateUTC || start < new Date(entry.nextDateUTC).getTime()) {
        entry.nextDateUTC = event.startTimeUTC;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.source === b.source) {
      const aDate = a.nextDateUTC ?? a.lastDateUTC ?? "";
      const bDate = b.nextDateUTC ?? b.lastDateUTC ?? "";
      return aDate.localeCompare(bDate);
    }
    return SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source);
  });
}

export default async function TournamentsPage() {
  const events = await getCalendarEvents();
  const digests = buildTournamentDigests(events);
  const grouped = SOURCE_ORDER.map((source) => ({
    source,
    meta: SOURCE_META[source],
    tournaments: digests.filter((item) => item.source === source),
  }));

  const totalTournaments = digests.length;
  const totalEvents = events.length;

  return (
    <main className="min-h-screen pb-16">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-4 pb-16 pt-12 sm:px-6">
        <header className="glass-panel px-6 py-7">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <p className="text-label">Fixture Fusion</p>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-white/90 sm:text-[2.5rem] sm:leading-[1.1]">
                  Турнирный срез по дисциплинам
                </h1>
                <p className="max-w-2xl text-sm text-white/65">
                  Консолидированная сводка выступлений Manchester United, Leeds United, Legacy CS2 и UFC.
                  Сравнивайте пул событий и ближайшие даты в часовом поясе Europe/Kyiv.
                </p>
              </div>
            </div>
            <div className="grid w-full max-w-[240px] grid-cols-2 gap-3 text-sm text-white/70 sm:text-right">
              <div className="glass-card">
                <p className="text-label">Всего турниров</p>
                <p className="mt-2 text-2xl font-semibold text-white/90">{totalTournaments}</p>
              </div>
              <div className="glass-card">
                <p className="text-label">Событий в пуле</p>
                <p className="mt-2 text-2xl font-semibold text-white/90">{totalEvents}</p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/" className="glass-button">
              ← Календарь
            </Link>
          </div>
        </header>

        {grouped.map(({ source, meta, tournaments }) => (
          <section
            key={source}
            className="glass-panel px-6 py-6"
          >
            <header className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="glass-panel inline-flex items-center gap-2 px-3 py-1">
                  <span
                    className="inline-flex h-2 w-2"
                    style={{ backgroundColor: meta.accent }}
                  />
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white/80">
                    {meta.label}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-white/90">Турниры и серии</h2>
                <p className="text-xs text-white/60">{meta.tagline}</p>
              </div>
              <div className="flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.26em] text-white/45">
                <span className="hidden sm:inline">Выбрано:</span>
                <span className="glass-panel px-3 py-1 text-white/80">
                  {tournaments.length}
                </span>
              </div>
            </header>

            {tournaments.length === 0 ? (
              <p className="pt-6 text-sm uppercase tracking-[0.28em] text-white/35">Нет данных о турнирах.</p>
            ) : (
              <div className="grid gap-4 pt-6 sm:grid-cols-2">
                {tournaments.map((tournament) => {
                  const nextDate = formatKyivDate(tournament.nextDateUTC);
                  const lastDate = formatKyivDate(tournament.lastDateUTC);

                  return (
                    <article
                      key={`${tournament.source}-${tournament.name}`}
                      className="glass-panel glass-panel-hover flex h-full flex-col justify-between gap-4 p-5"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-lg font-semibold text-white/90">{tournament.name}</h3>
                          <span
                            className="glass-panel px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.28em]"
                            style={{ borderColor: `${meta.accent}30`, color: meta.accent }}
                          >
                            {tournament.eventCount} событий
                          </span>
                        </div>
                        <p className="text-xs text-white/55">Обновлено: {lastDate?.uk ?? "—"}</p>
                      </div>

                      <div className="grid gap-3 text-xs text-white/65 sm:grid-cols-2">
                        <div className="glass-card">
                          <p className="text-label">Ближайшее</p>
                          <p className="mt-2 text-sm font-semibold text-white/90">{nextDate?.uk ?? "—"}</p>
                        </div>
                        <div className="glass-card">
                          <p className="text-label">Последнее</p>
                          <p className="mt-2 text-sm font-semibold text-white/90">{lastDate?.uk ?? "—"}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-[0.28em] text-white/50">
                        <span>EN: {nextDate?.en ?? "—"}</span>
                        <span>RU: {nextDate?.ru ?? "—"}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
