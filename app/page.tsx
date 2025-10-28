import { CalendarPage } from "@/components/calendar/CalendarPage";
import { getCalendarEvents } from "@/lib/events-service";

export default async function Home() {
  const events = await getCalendarEvents();

  return (
    <main className="min-h-screen pb-16">
      <CalendarPage events={events} />
    </main>
  );
}
