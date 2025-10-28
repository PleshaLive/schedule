export type CalendarSource = "MANCHESTER_UNITED" | "LEEDS_UNITED" | "LEGACY_CS2" | "UFC";

export type CalendarOutcome = "WIN" | "LOSS" | "DRAW";

export type CalendarEvent = {
  id: string;
  source: CalendarSource;
  title: string;
  competition?: string;
  fighters?: string;
  startTimeUTC: string;
  result?: string;
  outcome?: CalendarOutcome;
};

export type CalendarEventWithMeta = CalendarEvent & {
  venue?: string;
  location?: string;
  status?: string;
  url?: string;
  subtitle?: string;
};
