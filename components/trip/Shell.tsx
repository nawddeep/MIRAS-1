import Link from "next/link";

/** The PWA already provides the top bar and bottom navigation, so inside the trip planner this is only a back link. */
export function TopBar({ back }: { title?: string; back?: string }) {
  if (!back) return null;
  return (
    <div className="px-5 pt-3 pb-1">
      <Link href={back} className="icon-btn" aria-label="Back">
        <span aria-hidden="true">←</span>
      </Link>
    </div>
  );
}
