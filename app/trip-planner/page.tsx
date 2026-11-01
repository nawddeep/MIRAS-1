import Link from "next/link";
import { TopBar } from "@/components/trip/Shell";
import { ArrowIcon, PinIcon, PlanIcon, RouteIcon } from "@/components/trip/icons";

export default function Home() {
  return (
    <>
      <TopBar />
      <section className="px-6 pt-4 pb-6 anim-rise">
        <h1 className="text-[clamp(34px,9.5vw,54px)] leading-[1.06] tracking-[-0.045em]">Udaipur, your way.</h1>
        <p className="eyebrow mt-3 tracking-[0.24em]">Udaipur, Rajasthan</p>
        <p className="mt-4 max-w-[36ch] text-[17px] text-muted">
          Build a day-by-day trip from live data, or see what is around you right now.
        </p>
      </section>

      <section aria-label="Choose an experience" className="grid gap-4 px-5 md:grid-cols-2">
        <Link href="/trip-planner/plan" className="group relative block overflow-hidden rounded-[30px] bg-ink-2 p-6 text-white min-h-[240px] anim-rise">
          <PlanIcon size={30} />
          <p className="eyebrow mt-5 !text-white/70">Experience A</p>
          <h2 className="mt-1 text-[32px]">Plan my trip</h2>
          <p className="mt-2 max-w-[30ch] text-[16px] text-white/80">
            Transport, weather, a day-wise plan with meals and buffers, budget notes and essentials.
          </p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[15px] font-medium text-ink-2">
            Start planning <ArrowIcon size={18} />
          </span>
        </Link>

        <Link href="/trip-planner/explore" className="group relative block overflow-hidden rounded-[30px] bg-[#d9e7e9] p-6 min-h-[240px] anim-rise">
          <PinIcon size={30} />
          <p className="eyebrow mt-5">Experience B</p>
          <h2 className="mt-1 text-[32px]">Explore around me</h2>
          <p className="mt-2 max-w-[30ch] text-[16px] text-[#41565e]">
            Cafés, hidden gems, artisans, stays, rentals and more on a map, with Google Maps links.
          </p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink-2 px-4 py-2.5 text-[15px] font-medium text-white">
            Open the map <ArrowIcon size={18} />
          </span>
        </Link>
      </section>

      <section className="mx-5 mt-6 tile flex items-start gap-3">
        <RouteIcon className="mt-0.5 shrink-0" />
        <p className="text-[15px] leading-6 text-muted">
          This app shows information only. It never books or takes payments: every option links to the provider or
          its Google Maps listing. Each card says where its data came from and when it was checked.
        </p>
      </section>
    </>
  );
}
