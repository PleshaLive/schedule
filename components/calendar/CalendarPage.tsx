"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  isTomorrow,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { enUS, ru, uk } from "date-fns/locale";
import clsx from "clsx";
import { utcToZonedTime } from "date-fns-tz";

import { CalendarEventWithMeta, CalendarSource } from "@/types/events";

type CalendarPageProps = {
  events: CalendarEventWithMeta[];
  initialMonth?: string;
};

type CalendarUiEvent = CalendarEventWithMeta & {
  localDateKey: string;
  localDateLabel: string;
  localTimeLabel: string;
  isPast: boolean;
};

const KYIV_TZ = "Europe/Kyiv";
const PARIMATCH_FONT_STACK = "'Parimatch Sans', 'Inter', sans-serif";

const STREAM_ORDER: CalendarSource[] = ["MANCHESTER_UNITED", "LEEDS_UNITED", "LEGACY_CS2", "UFC"];

const STREAM_META: Record<CalendarSource, { label: string; short: string; accent: string }> = {
  MANCHESTER_UNITED: {
    label: "Manchester United",
    short: "MUFC",
    accent: "#F5C400",
  },
  LEEDS_UNITED: {
    label: "Leeds United",
    short: "LUFC",
    accent: "#3B82F6",
  },
  LEGACY_CS2: {
    label: "Legacy CS2",
    short: "CS2",
    accent: "#00F5D4",
  },
  UFC: {
    label: "UFC",
    short: "UFC",
    accent: "#FF2A3D",
  },
};

const TEAM_STREAMS: CalendarSource[] = ["MANCHESTER_UNITED", "LEEDS_UNITED"];

export function CalendarPage({ events, initialMonth }: CalendarPageProps) {
  const enhancedEvents = useMemo(() => events.map(toUiEvent), [events]);

  const [todayKey] = useState(getTodayKey);
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => {
    if (initialMonth) {
      return format(startOfMonth(resolveInitialMonth(initialMonth)), "yyyy-MM-dd");
    }
    return getTodayKey();
  });
  const [activeStreams, setActiveStreams] = useState<CalendarSource[]>(STREAM_ORDER);
  const [currentMonth, setCurrentMonth] = useState(() =>
    startOfMonth(resolveInitialMonth(initialMonth)),
  );
  const [selectedEvent, setSelectedEvent] = useState<CalendarUiEvent | null>(null);
  const [pendingScrollKey, setPendingScrollKey] = useState<string | null>(null);
  const [focusedDayKey, setFocusedDayKey] = useState<string | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);

  const dayRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const focusTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!initialMonth) {
      return;
    }

    setCurrentMonth(startOfMonth(resolveInitialMonth(initialMonth)));
  }, [initialMonth]);

  useEffect(() => {
    setSelectedDayKey((prev) => {
      if (!prev) {
        return format(currentMonth, "yyyy-MM-dd");
      }

      const parsedPrev = parseISO(prev);
      if (Number.isNaN(parsedPrev.getTime()) || !isSameMonth(parsedPrev, currentMonth)) {
        return format(currentMonth, "yyyy-MM-dd");
      }

      return prev;
    });
  }, [currentMonth]);

  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        window.clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  const filteredEvents = useMemo(
    () => enhancedEvents.filter((event) => activeStreams.includes(event.source)),
    [enhancedEvents, activeStreams],
  );

  const monthlyEvents = useMemo(
    () =>
      filteredEvents.filter((event) =>
        isSameMonth(parseISO(event.localDateKey), currentMonth),
      ),
    [filteredEvents, currentMonth],
  );

  useEffect(() => {
    if (selectedEvent && !filteredEvents.some((event) => event.id === selectedEvent.id)) {
      setSelectedEvent(null);
    }
  }, [filteredEvents, selectedEvent]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarUiEvent[]>();

    for (const event of filteredEvents) {
      const dayEvents = grouped.get(event.localDateKey);
      if (dayEvents) {
        dayEvents.push(event);
      } else {
        grouped.set(event.localDateKey, [event]);
      }
    }

    return grouped;
  }, [filteredEvents]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    const weeks: Date[][] = [];

    for (let index = 0; index < days.length; index += 7) {
      weeks.push(days.slice(index, index + 7));
    }

    return weeks;
  }, [currentMonth]);

  useEffect(() => {
    if (!pendingScrollKey) {
      return undefined;
    }

    if (typeof window === "undefined") {
      return undefined;
    }

    const frame = window.setTimeout(() => {
      const node = dayRefs.current[pendingScrollKey];
      if (!node) {
        setPendingScrollKey(null);
        return;
      }

      node.scrollIntoView({ behavior: "smooth", block: "center" });
      setFocusedDayKey(pendingScrollKey);

      if (focusTimeoutRef.current) {
        window.clearTimeout(focusTimeoutRef.current);
      }

      focusTimeoutRef.current = window.setTimeout(() => {
        setFocusedDayKey(null);
        focusTimeoutRef.current = null;
      }, 2600);

      setPendingScrollKey(null);
    }, 80);

    return () => {
      window.clearTimeout(frame);
    };
  }, [pendingScrollKey, calendarDays]);

  const handleStreamToggle = (stream: CalendarSource) => {
    setActiveStreams((prev) =>
      prev.includes(stream) ? prev.filter((item) => item !== stream) : [...prev, stream],
    );
  };

  const handleJumpToToday = () => {
    const now = utcToZonedTime(new Date(), KYIV_TZ);
    const key = format(now, "yyyy-MM-dd");

    setCurrentMonth(startOfMonth(now));
    setSelectedDayKey(key);
    setPendingScrollKey(key);
  };

  const totalEvents = monthlyEvents.length;
  const clubEvents = monthlyEvents.filter(
    (event) => event.source === "MANCHESTER_UNITED" || event.source === "LEEDS_UNITED",
  ).length;
  const legacyEvents = monthlyEvents.filter((event) => event.source === "LEGACY_CS2").length;
  const ufcEvents = monthlyEvents.filter((event) => event.source === "UFC").length;

  const nextEvents = useMemo(() => {
    const now = Date.now();
    return filteredEvents
      .filter((event) => new Date(event.startTimeUTC).getTime() >= now)
      .sort((a, b) => new Date(a.startTimeUTC).getTime() - new Date(b.startTimeUTC).getTime())
      .slice(0, 6);
  }, [filteredEvents]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDayKey) {
      return [];
    }

    const dayEvents = eventsByDay.get(selectedDayKey) ?? [];
    return [...dayEvents].sort(
      (a, b) => new Date(a.startTimeUTC).getTime() - new Date(b.startTimeUTC).getTime(),
    );
  }, [selectedDayKey, eventsByDay]);

  const selectedDayLabel = selectedDayKey ? formatDateKeyLabel(selectedDayKey) : "Выберите день";
  const currentYearLabel = format(currentMonth, "yyyy");
  const monthLabelUk = capitalizeLabel(format(currentMonth, "LLLL", { locale: uk }));
  const monthLabelRu = capitalizeLabel(format(currentMonth, "LLLL", { locale: ru }));
  const monthLabelEn = capitalizeLabel(format(currentMonth, "LLLL", { locale: enUS }));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-neutral-800/50 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[1600px] px-6 py-4 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.35em] text-yellow-400">
                Partners
              </div>
              <h1 className="text-xl font-extrabold uppercase tracking-[0.3em] text-slate-100 sm:text-2xl">
                Partners Schedule
              </h1>
            </div>
            <div className="flex items-center gap-3"></div>
          </div>
          <nav className="custom-scrollbar mt-4 flex gap-2 overflow-x-auto pb-2">
            {STREAM_ORDER.map((stream) => {
              const meta = STREAM_META[stream];
              const isActive = activeStreams.includes(stream);

              return (
                <button
                  key={`filter-${stream}`}
                  type="button"
                  onClick={() => handleStreamToggle(stream)}
                  className={clsx(
                    "badge whitespace-nowrap transition-all",
                    isActive ? "badge-primary" : "border-neutral-800/50 bg-black/60 text-neutral-400 hover:border-neutral-700/50 hover:text-neutral-300"
                  )}
                >
                  {meta.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

  <main className="mx-auto w-full max-w-[1600px] px-6 py-8 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <section className="space-y-6">
            <div className="neo-card">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentMonth((prev) => addMonths(prev, -1))}
                    aria-label="Предыдущий месяц"
                    className="btn-outline flex h-10 w-10 items-center justify-center p-0"
                  >
                    ←
                  </button>
                  <div>
                    <div className="label">Текущий месяц</div>
                    <h2 className="text-xl font-bold text-slate-100">
                      {monthLabelUk} / {monthLabelRu} / {monthLabelEn}
                    </h2>
                    <div className="mt-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                      {currentYearLabel}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                    aria-label="Следующий месяц"
                    className="btn-outline flex h-10 w-10 items-center justify-center p-0"
                  >
                    →
                  </button>
                  <button
                    type="button"
                    onClick={handleJumpToToday}
                    className="btn-outline today-compact"
                  >
                    Сегодня
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Всего событий (месяц)", value: totalEvents },
                  { label: "Клубные", value: clubEvents },
                  { label: "Legacy CS2", value: legacyEvents },
                  { label: "UFC", value: ufcEvents },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="border border-neutral-800/60 bg-black/70 px-3 py-2 text-left shadow-[0_0_20px_rgba(0,0,0,0.35)]"
                  >
                    <div className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-neutral-400">
                      {item.label}
                    </div>
                    <div className="mt-1 text-xl font-semibold text-white leading-tight">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="neo-card overflow-hidden p-0">
              <div className="grid grid-cols-7 gap-px border-b border-neutral-800/50 bg-black/40 p-4 text-center">
                {"Пн Вт Ср Чт Пт Сб Вс".split(" ").map((weekday) => (
                  <div key={weekday} className="label">
                    {weekday}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2 p-4">
                {calendarDays.map((week, weekIndex) =>
                  week.map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    const dayEvents: CalendarUiEvent[] = eventsByDay.get(key) ?? [];
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isTodayDay = key === todayKey;
                    const isFocused = focusedDayKey === key;
                    const isSelectedDay = selectedDayKey === key;
                    const hasTeamWin = dayEvents.some(
                      (event) => TEAM_STREAMS.includes(event.source) && event.outcome === "WIN",
                    );
                    const dayEventLabels = dayEvents.map((event) => {
                      const meta = STREAM_META[event.source];
                      return {
                        id: event.id,
                        label: (event.source === "UFC" ? "UFC" : event.title).toUpperCase(),
                        accent: meta.accent,
                      };
                    });
                    const displayedLabels = dayEventLabels.slice(0, 3);
                    const extraCount = dayEvents.length - displayedLabels.length;

                    return (
                      <button
                        key={`${weekIndex}-${key}`}
                        type="button"
                        ref={(node) => {
                          if (node) {
                            dayRefs.current[key] = node;
                          } else {
                            delete dayRefs.current[key];
                          }
                        }}
                        data-day-key={key}
                        onClick={() => {
                          setSelectedDayKey(key);
                          setShowDayModal(true);
                          if (!isSameMonth(day, currentMonth)) {
                            setCurrentMonth(startOfMonth(day));
                          }
                        }}
                        className={clsx(
                          "calendar-day min-h-[140px]",
                          !isCurrentMonth && "opacity-40",
                          hasTeamWin && "ring-2 ring-green-500/40",
                          isTodayDay && "today",
                          isSelectedDay && "selected",
                          isFocused && "scale-105"
                        )}
                      >
                        <div className="flex flex-col gap-1">
                          {isTodayDay && (
                            <span className="inline-flex w-fit items-center gap-1.5 border border-yellow-500/40 bg-yellow-500/5 px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-yellow-400/90">
                              <span className="inline-block h-1 w-1 bg-yellow-400 animate-pulse" />
                              Сегодня
                            </span>
                          )}
                          <span className="text-3xl font-bold text-slate-100">
                            {format(day, "d")}
                          </span>
                          <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-neutral-500">
                            {format(day, "LLLL", { locale: ru })}
                          </span>
                        </div>
                        <div className="mt-auto space-y-1.5 pt-3">
                          {displayedLabels.length === 0 ? (
                            <span className="label block text-center">Нет событий</span>
                          ) : (
                            displayedLabels.map((item) => (
                              <div
                                key={`${key}-${item.id}`}
                                className="event-tag truncate text-center text-white"
                                style={{ borderColor: `${item.accent}50` }}
                              >
                                {item.label}
                              </div>
                            ))
                          )}
                          {extraCount > 0 && (
                            <span className="label block text-center">
                              +{extraCount} ещё
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  }),
                )}
              </div>
            </div>
          </section>

          <aside className="hidden flex-col gap-4 xl:flex">
            <div className="glass-panel sticky top-[104px] flex flex-col gap-4 p-5">
              <header className="space-y-1">
                <p className="text-label">Ближайшие</p>
                <h3
                  className="text-base font-semibold text-white/90"
                  style={{ fontFamily: PARIMATCH_FONT_STACK }}
                >
                  В выбранных фильтрах
                </h3>
              </header>
              {nextEvents.length === 0 ? (
                <p className="text-sm text-white/55">Нет событий в выбранных фильтрах.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {nextEvents.map((event) => {
                    const meta = STREAM_META[event.source];
                    const status = resolveEventStatus(event);
                    if (status !== "UPCOMING") {
                      return null;
                    }
                    const startDate = new Date(event.startTimeUTC);

                    return (
                      <li key={`upcoming-${event.id}`}>
                        <button
                          type="button"
                          onClick={() => setSelectedEvent(event)}
                          className="glass-panel glass-panel-hover flex w-full flex-col gap-2 px-4 py-3 text-left text-xs"
                        >
                          <div className="flex items-center justify-between text-[0.55rem] uppercase tracking-[0.28em] text-white/50">
                            <span>{format(startDate, "dd MMM • HH:mm", { locale: ru })}</span>
                            <span
                              className="glass-panel px-2 py-0.5"
                              style={{ borderColor: `${meta.accent}30`, color: meta.accent }}
                            >
                              {meta.short}
                            </span>
                          </div>
                          <p
                            className="text-sm font-semibold text-white/90"
                            style={{ fontFamily: PARIMATCH_FONT_STACK }}
                          >
                            {event.title}
                          </p>
                          <span className="glass-panel inline-flex w-fit items-center gap-1 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.3em] text-white/80">
                            {formatUpcomingBadge(event.startTimeUTC)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </div>

        <section className="mt-6 xl:hidden">
          <div className="glass-panel flex flex-col gap-4 p-5">
            <header className="space-y-1">
              <p className="text-label">Ближайшие</p>
              <h3
                className="text-base font-semibold text-white/90"
                style={{ fontFamily: PARIMATCH_FONT_STACK }}
              >
                В выбранных фильтрах
              </h3>
            </header>
            {nextEvents.length === 0 ? (
              <p className="text-sm text-white/55">Нет событий в выбранных фильтрах.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {nextEvents.map((event) => {
                  const meta = STREAM_META[event.source];
                  const status = resolveEventStatus(event);
                  if (status !== "UPCOMING") {
                    return null;
                  }
                  const startDate = new Date(event.startTimeUTC);

                  return (
                    <li key={`upcoming-mobile-${event.id}`}>
                      <button
                        type="button"
                        onClick={() => setSelectedEvent(event)}
                        className="glass-panel glass-panel-hover flex w-full flex-col gap-2 px-4 py-3 text-left text-xs"
                      >
                        <div className="flex items-center justify-between text-[0.55rem] uppercase tracking-[0.28em] text-white/50">
                          <span>{format(startDate, "dd MMM • HH:mm", { locale: ru })}</span>
                          <span
                            className="glass-panel px-2 py-0.5"
                            style={{ borderColor: `${meta.accent}30`, color: meta.accent }}
                          >
                            {meta.short}
                          </span>
                        </div>
                        <p
                          className="text-sm font-semibold text-white/90"
                          style={{ fontFamily: PARIMATCH_FONT_STACK }}
                        >
                          {event.title}
                        </p>
                        <span className="glass-panel inline-flex w-fit items-center gap-1 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.3em] text-white/80">
                          {formatUpcomingBadge(event.startTimeUTC)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </main>

      {selectedEvent ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="glass-panel relative w-full max-w-2xl p-8 text-white"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="glass-button absolute right-4 top-4 flex h-8 w-8 items-center justify-center p-0"
              aria-label="Закрыть"
            >
              ✕
            </button>

            <div className="flex flex-col gap-5">
              <div className="space-y-2">
                <p className="text-label">
                  {capitalizeLabel(
                    format(new Date(selectedEvent.startTimeUTC), "EEEE, d MMMM yyyy", { locale: ru }),
                  )}
                </p>
                <h3
                  className="text-2xl font-semibold text-white/90"
                  style={{ fontFamily: PARIMATCH_FONT_STACK }}
                >
                  {selectedEvent.title}
                </h3>
                {selectedEvent.subtitle ? (
                  <p className="text-xs text-white/60">{selectedEvent.subtitle}</p>
                ) : null}
              </div>

              <div className="grid gap-3 text-[0.75rem] text-white/70 sm:grid-cols-2">
                <div className="glass-card">
                  <p className="text-label">Время</p>
                  <p
                    className="mt-2 text-base font-semibold text-white/90"
                    style={{ fontFamily: PARIMATCH_FONT_STACK }}
                  >
                    {selectedEvent.localTimeLabel}
                  </p>
                </div>
                <div className="glass-card">
                  <p className="text-label">Статус</p>
                  <p
                    className="mt-2 text-base font-semibold text-white/90"
                    style={{ fontFamily: PARIMATCH_FONT_STACK }}
                  >
                    {selectedEvent.status ?? "Без статуса"}
                  </p>
                </div>
                {selectedEvent.venue ? (
                  <div className="glass-card">
                    <p className="text-label">Стадион</p>
                    <p
                      className="mt-2 text-base font-semibold text-white/90"
                      style={{ fontFamily: PARIMATCH_FONT_STACK }}
                    >
                      {selectedEvent.venue}
                    </p>
                  </div>
                ) : null}
                {selectedEvent.location ? (
                  <div className="glass-card">
                    <p className="text-label">Локация</p>
                    <p
                      className="mt-2 text-base font-semibold text-white/90"
                      style={{ fontFamily: PARIMATCH_FONT_STACK }}
                    >
                      {selectedEvent.location}
                    </p>
                  </div>
                ) : null}
              </div>

              {selectedEvent.result ? (
                <div className="glass-card text-[0.75rem] text-white/70">
                  <p className="text-label">Результат</p>
                  <p
                    className="mt-2 text-base font-semibold text-white/90"
                    style={{ fontFamily: PARIMATCH_FONT_STACK }}
                  >
                    {selectedEvent.result}
                  </p>
                </div>
              ) : null}

              {selectedEvent.url ? (
                <Link
                  href={selectedEvent.url}
                  target="_blank"
                  rel="noreferrer"
                  className="glass-button flex items-center justify-center gap-2"
                >
                  Подробнее о событии
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Day Modal - Full Screen */}
      {showDayModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowDayModal(false)}
        >
          <div
            className="neo-card relative w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowDayModal(false)}
              className="btn-outline absolute right-6 top-6 flex h-10 w-10 items-center justify-center p-0 text-xl"
              aria-label="Закрыть"
            >
              ✕
            </button>

            <div className="mb-8">
              <div className="label mb-2">Выбранный день</div>
              <h2 className="text-4xl font-bold text-slate-100">
                {selectedDayLabel}
              </h2>
              <div className="mt-4 flex items-center gap-3">
                <span className="badge badge-primary">
                  {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'событие' : 'событий'}
                </span>
                {selectedDayKey === todayKey && (
                  <span className="badge badge-warning">Сегодня</span>
                )}
              </div>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="border border-neutral-800/50 bg-black/40 p-12 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center bg-neutral-900/50">
                  <span className="text-4xl">📅</span>
                </div>
                <p className="text-lg font-semibold text-neutral-300">В этот день пока нет событий</p>
                <p className="mt-2 text-sm text-neutral-500">Выберите другой день в календаре</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {selectedDayEvents.map((event) => {
                  const meta = STREAM_META[event.source];
                  const status = resolveEventStatus(event);
                  const statusLabel =
                    status === "LIVE" ? "LIVE" : status === "UPCOMING" ? "UPCOMING" : "FINISHED";

                  return (
                    <div
                      key={`modal-${event.id}`}
                      className="group relative overflow-hidden border border-neutral-800/50 bg-gradient-to-br from-black/80 to-black/40 p-6 transition-all hover:scale-[1.02] hover:border-neutral-700/50 hover:shadow-2xl hover:shadow-black/60"
                    >
                      {/* Accent line */}
                      <div
                        className="absolute left-0 top-0 h-full w-1"
                        style={{ background: `linear-gradient(to bottom, ${meta.accent}, transparent)` }}
                      />

                      <div className="mb-4">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <h3 className="text-xl font-bold text-slate-100 leading-tight">
                            {event.title}
                          </h3>
                          <span
                            className="badge badge-primary shrink-0 text-xs"
                            style={{ borderColor: `${meta.accent}40`, color: meta.accent }}
                          >
                            {event.source === "UFC" ? "UFC" : meta.short}
                          </span>
                        </div>
                        {event.subtitle && (
                          <p className="text-sm text-neutral-400">{event.subtitle}</p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-neutral-400">🕐</span>
                          <span className="font-semibold text-neutral-200">{event.localTimeLabel}</span>
                        </div>

                        {event.venue && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-400">🏟️</span>
                            <span className="text-slate-300">{event.venue}</span>
                          </div>
                        )}

                        {event.location && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-400">📍</span>
                            <span className="text-slate-300">{event.location}</span>
                          </div>
                        )}

                        {event.result && (
                          <div className="border border-slate-700/30 bg-slate-900/40 p-3">
                            <div className="label mb-1">Результат</div>
                            <p className="font-bold text-slate-100">{event.result}</p>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 pt-2">
                          <span className={clsx(
                            "badge text-xs",
                            status === "LIVE" ? "badge-success" : 
                            status === "UPCOMING" ? "badge-warning" : 
                            "border-slate-700/50 bg-slate-800/30 text-slate-400"
                          )}>
                            {statusLabel}
                          </span>
                          {event.outcome && (
                            <span className={clsx(
                              "badge text-xs",
                              event.outcome === "WIN" ? "badge-success" :
                              event.outcome === "LOSS" ? "border-red-500/30 bg-red-500/10 text-red-400" :
                              "badge-warning"
                            )}>
                              {event.outcome}
                            </span>
                          )}
                        </div>
                      </div>

                      {event.url && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowDayModal(false);
                          }}
                          className="btn-gradient mt-4 w-full"
                        >
                          Подробнее →
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function resolveInitialMonth(initialMonth?: string): Date {
  if (!initialMonth) {
    return utcToZonedTime(new Date(), KYIV_TZ);
  }

  const normalized = initialMonth.length === 7 ? `${initialMonth}-01` : initialMonth;
  const parsed = parseISO(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return utcToZonedTime(new Date(), KYIV_TZ);
  }

  return utcToZonedTime(parsed, KYIV_TZ);
}

function getTodayKey() {
  const now = utcToZonedTime(new Date(), KYIV_TZ);
  return format(now, "yyyy-MM-dd");
}

function toUiEvent(event: CalendarEventWithMeta): CalendarUiEvent {
  const utcDate = new Date(event.startTimeUTC);
  const zoned = utcToZonedTime(utcDate, KYIV_TZ);

  return {
    ...event,
    localDateKey: format(zoned, "yyyy-MM-dd"),
    localDateLabel: capitalizeLabel(format(zoned, "d MMMM", { locale: ru })),
    localTimeLabel: format(zoned, "HH:mm"),
    isPast: zoned.getTime() < Date.now(),
  };
}

function formatDateKeyLabel(value: string) {
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return capitalizeLabel(format(parsed, "d MMMM yyyy", { locale: ru }));
}

function resolveEventStatus(event: CalendarUiEvent): "UPCOMING" | "LIVE" | "FINISHED" {
  const raw = event.status?.toLowerCase() ?? "";

  if (raw.includes("live")) {
    return "LIVE";
  }

  if (raw.includes("upcoming") || raw.includes("scheduled")) {
    return "UPCOMING";
  }

  if (raw.includes("finished") || raw.includes("final") || raw.includes("result")) {
    return "FINISHED";
  }

  return event.isPast ? "FINISHED" : "UPCOMING";
}

function formatUpcomingBadge(startTimeUTC: string) {
  const date = utcToZonedTime(new Date(startTimeUTC), KYIV_TZ);
  const today = utcToZonedTime(new Date(), KYIV_TZ);

  if (isToday(date)) {
    return "СЕГОДНЯ";
  }

  if (isTomorrow(date)) {
    return "ЗАВТРА";
  }

  const diff = differenceInCalendarDays(date, today);
  if (diff > 0) {
    return `ЧЕРЕЗ ${diff} ДН.`;
  }

  if (diff === -1) {
    return "БЫЛ ВЧЕРА";
  }

  if (diff < 0) {
    return "АРХИВ";
  }

  return "СКОРО";
}

function capitalizeLabel(value: string) {
  if (!value) {
    return value;
  }

  return value[0].toUpperCase() + value.slice(1);
}
