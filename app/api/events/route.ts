import { NextResponse } from "next/server";
import { getCalendarEvents } from "@/lib/events-service";
import type { CalendarEvent, CalendarEventWithMeta } from "@/types/events";

export const revalidate = 1800; // cache JSON for 30 minutes

export async function GET() {
  try {
    const events = await getCalendarEvents();

    const payload: { events: CalendarEvent[] } = {
      events: events.map((event: CalendarEventWithMeta) => {
        const { venue, location, status, subtitle, ...publicFields } = event;
        void venue;
        void location;
        void status;
        void subtitle;
        return publicFields;
      }),
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("Failed to load calendar events", error);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}
