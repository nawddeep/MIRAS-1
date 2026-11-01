import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./trip-planner.css";
import { TripNav } from "@/components/trip/TripNav";

export const metadata: Metadata = {
  title: "Trip planner · MIRAS",
  description: "Plan a day-by-day Udaipur trip from live data, or explore what is around you. Information only: bookings happen on the provider's site.",
};

export default function TripPlannerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="trip-planner">
      <TripNav />
      {children}
    </div>
  );
}
