import type { ReactNode } from "react";
import { checkedAt } from "@/lib/trip/format";
import type { DataType, Provenance, ProviderStatus } from "@/lib/trip/types";

const BADGE: Record<DataType | "User", string> = {
  Live: "badge badge-live",
  Scheduled: "badge badge-scheduled",
  Estimated: "badge badge-estimated",
  Historical: "badge badge-historical",
  User: "badge badge-user",
};

const BADGE_HELP: Record<DataType | "User", string> = {
  Live: "Fetched from the provider for this search",
  Scheduled: "Published timetable, not confirmed availability",
  Estimated: "Calculated estimate, not provider data",
  Historical: "Past or reference data, may be out of date",
  User: "Entered by you",
};

export function DataBadge({ type }: { type: DataType | "User" }) {
  return <span className={BADGE[type]} title={BADGE_HELP[type]}>{type}</span>;
}

/** Type badge + source + last checked: shown on every data card. */
export function SourceLine({ p, className = "" }: { p: Provenance; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 text-muted ${className}`}>
      <DataBadge type={p.data_type} />
      <span>{p.source}</span>
      <span aria-hidden="true">·</span>
      <span>Checked {checkedAt(p.last_checked)}</span>
      {p.note && <span className="basis-full">{p.note}</span>}
    </div>
  );
}

export function NotAvailable({ what = "Not available" }: { what?: string }) {
  return <span className="text-muted italic">{what}</span>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-dashed border-line bg-white/50 p-5" role="status">
      <p className="text-[19px] tracking-tight">{title}</p>
      {children && <div className="mt-2 text-[15px] text-muted">{children}</div>}
    </div>
  );
}

export function ErrorBox({ title = "Something went wrong", children, action, className = "" }: { title?: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`alert ${className}`} role="alert">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

const STATE_TEXT: Record<string, string> = {
  not_configured: "not configured",
  error: "had an error",
  empty: "returned no results",
  skipped: "skipped",
};

/** Explains which providers could not contribute, so empty results are never mysterious. */
export function ProviderNotice({ providers, className = "" }: { providers: ProviderStatus[]; className?: string }) {
  const problems = providers.filter((p) => p.state !== "ok");
  if (!problems.length) return null;
  const ok = providers.filter((p) => p.state === "ok").map((p) => p.provider);
  return (
    <details className={`notice ${className}`}>
      <summary className="cursor-pointer min-h-[28px]">
        {ok.length ? `Using ${ok.join(", ")}.` : "No data provider answered."}{" "}
        {problems.length} provider{problems.length > 1 ? "s" : ""} unavailable
      </summary>
      <ul className="mt-2 space-y-1 text-[14px]">
        {problems.map((p, i) => (
          <li key={`${p.provider}-${p.state}-${i}`}>
            <strong className="font-medium">{p.provider}</strong> {STATE_TEXT[p.state] ?? p.state}
            {p.message ? `: ${p.message}` : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function SectionHeading({ eyebrow, title, action, id }: { eyebrow?: string; title: string; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 id={id} className="text-[26px] md:text-[30px]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 text-[15px]">
      <span className="text-[12px] uppercase tracking-[0.08em] text-muted">{label}</span>
      <span>{children}</span>
    </div>
  );
}
