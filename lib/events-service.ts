import { cache } from "react";
import { CalendarEventWithMeta } from "@/types/events";
import {
  fetchLeedsUnitedEvents,
  fetchManchesterUnitedEvents,
  fetchLegacyCs2Events,
  fetchUfcEvents,
} from "@/lib/data-sources";

const SORT_ORDER: Record<CalendarEventWithMeta["source"], number> = {
  MANCHESTER_UNITED: 0,
  LEEDS_UNITED: 1,
  LEGACY_CS2: 2,
  UFC: 3,
};

function sortEvents(events: CalendarEventWithMeta[]): CalendarEventWithMeta[] {
  return events.toSorted((a, b) => {
    const dateComparison = new Date(a.startTimeUTC).getTime() - new Date(b.startTimeUTC).getTime();
    if (dateComparison !== 0) {
      return dateComparison;
    }
    return SORT_ORDER[a.source] - SORT_ORDER[b.source];
  });
}

export const getCalendarEvents = cache(async (): Promise<CalendarEventWithMeta[]> => {
  const [manUnited, leeds, legacyCs2, ufc] = await Promise.all([
    fetchManchesterUnitedEvents(),
    fetchLeedsUnitedEvents(),
    fetchLegacyCs2Events(),
    fetchUfcEvents(),
  ]);

  return sortEvents([...manUnited, ...leeds, ...legacyCs2, ...ufc]);
});
