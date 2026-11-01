import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { t, type Lang } from "@/lib/i18n";
import type { SourceType } from "@/lib/schemas";
import { SearchIcon } from "./icons";

// Shared UI set. No hooks here, so these work in server and client components.

// Saffron is the only action colour ("accent", one per screen). Ink and outline buttons are secondary actions.
const buttonStyles = {
  primary: "bg-ink text-on-dark hover:bg-ink-2",
  accent: "bg-saffron text-ink hover:brightness-95",
  secondary: "border border-current/30 hover:bg-ink/5",
} as const;
type Variant = keyof typeof buttonStyles;
const buttonBase =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-input px-5 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${buttonBase} ${buttonStyles[variant]} ${className}`} {...props} />;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${buttonBase} ${buttonStyles[variant]} ${className}`} {...props} />;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-card border border-line bg-paper-2 p-4 text-on-paper ${className}`}>{children}</div>;
}

/* ---------- Labels and badges: one component per label, one style each ---------- */

const labelTones = {
  // Honesty labels share one style: Sample uses a dashed saffron border, the rest a solid one.
  sample: "border border-dashed border-saffron-text bg-paper text-saffron-text",
  warn: "border border-saffron-text bg-paper text-saffron-text",
  // Information (lake), people and makers (rose), consent (ok).
  info: "bg-lake text-ink",
  rose: "bg-rose text-ink",
  ok: "bg-ok text-ink",
  saffron: "bg-saffron text-ink",
  neutral: "bg-ink/10 text-current",
} as const;

export function Label({ tone = "neutral", children, title }: { tone?: keyof typeof labelTones; children: ReactNode; title?: string }) {
  if (tone === "sample") return null;
  return (
    <span title={title} className={`inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold tracking-wide ${labelTones[tone]}`}>
      {children}
    </span>
  );
}

export function SampleBadge({ lang }: { lang: Lang }) {
  return (
    <Label tone="sample" title={t(lang, "sampleExplainer")}>
      {t(lang, "sampleContent")}
    </Label>
  );
}

/** Labels for anything not real or not verified: Concept, Illustrative, Demo response, Estimate, Synthetic voice. */
export function NotRealLabel({ lang, kind }: { lang: Lang; kind: "concept" | "illustrative" | "demoResponse" | "estimate" | "syntheticVoice" }) {
  if (kind === "illustrative") return null;
  return <Label tone="warn">{t(lang, kind)}</Label>;
}
export const ConceptBadge = ({ lang }: { lang: Lang }) => <NotRealLabel lang={lang} kind="concept" />;
export const DemoBadge = ({ lang }: { lang: Lang }) => <NotRealLabel lang={lang} kind="demoResponse" />;
export const EstimateBadge = ({ lang }: { lang: Lang }) => <NotRealLabel lang={lang} kind="estimate" />;
export const SyntheticVoiceBadge = ({ lang }: { lang: Lang }) => <NotRealLabel lang={lang} kind="syntheticVoice" />;
export const IllustrativeBadge = ({ lang }: { lang: Lang }) => <NotRealLabel lang={lang} kind="illustrative" />;
export const NotVerified = ({ lang }: { lang: Lang }) => <Label tone="warn">{t(lang, "notVerified")}</Label>;

/** Shown only when a story is verified and not a sample (rule 5). */
export const VerifiedSourceBadge = ({ lang }: { lang: Lang }) => <Label tone="info">{lang === "hi" ? "स्रोत सहित" : "Sourced story"}</Label>;
/** Shown only when an artisan passes the publish gates. Never "Verified artisan". */
export const ConsentBadge = ({ lang }: { lang: Lang }) => <Label tone="ok">{t(lang, "consentRecorded")}</Label>;
export const ConfirmedByMakerBadge = ({ lang }: { lang: Lang }) => <Label tone="ok">{t(lang, "confirmedByMaker")}</Label>;
export const ArtisanChip = ({ lang }: { lang: Lang }) => <Label tone="rose">{t(lang, "artisanChip")}</Label>;

// Source chips are fixed and never change with the time of day.
const sourceTone: Record<SourceType, keyof typeof labelTones> = {
  history: "info",
  oral_tradition: "rose",
  legend: "saffron",
};

export function SourceTypeLabel({ lang, type }: { lang: Lang; type: SourceType }) {
  return <Label tone={sourceTone[type]}>{t(lang, `sourceType_${type}`)}</Label>;
}
export const SourceChip = SourceTypeLabel;

/* ---------- States ---------- */

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line p-6 text-center">
      <p className="t-heading">{title}</p>
      {children && <div className="mt-2 text-muted-paper">{children}</div>}
    </div>
  );
}

export function ErrorState({ lang, message, action }: { lang: Lang; message?: string; action?: ReactNode }) {
  return (
    <div role="alert" className="rounded-card border border-rose bg-rose/10 p-6">
      <p className="t-heading">{t(lang, "errorTitle")}</p>
      <p className="mt-1 text-muted-paper">{message ?? t(lang, "errorBody")}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function OfflineState({ children }: { children?: ReactNode }) {
  return (
    <div role="status" className="rounded-card border border-lake-deep/30 bg-lake/15 p-5">
      <p className="t-heading">You are offline</p>
      <p className="mt-1 text-muted-paper">{children ?? "Pages you saved for offline are still available."}</p>
    </div>
  );
}

export function PermissionDenied({ what, children }: { what: "camera" | "microphone"; children?: ReactNode }) {
  return (
    <div role="alert" className="rounded-card border border-rose bg-rose/10 p-5">
      <p className="t-heading">The {what} is blocked</p>
      <p className="mt-1">You can allow it in your browser settings, or carry on without it.</p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-ink/10 ${className}`} aria-hidden="true" />;
}

export function SearchBox({ lang, defaultValue = "", autoFocus = false }: { lang: Lang; defaultValue?: string; autoFocus?: boolean }) {
  return (
    <form action="/search" method="get" role="search" className="flex w-full gap-2">
      <label className="sr-only" htmlFor="q">
        {t(lang, "searchPlaceholder")}
      </label>
      <div className="relative min-w-0 flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-paper" size={20} />
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          placeholder={t(lang, "searchPlaceholder")}
          className="min-h-[52px] w-full rounded-full border border-line bg-paper-2 pr-4 pl-11 text-base text-on-paper outline-none focus:border-lake-deep"
        />
      </div>
      <Button type="submit">{t(lang, "searchButton")}</Button>
    </form>
  );
}

/** The "decline when unsure" state. Always offers search. */
export function IDontKnow({ lang, title, body }: { lang: Lang; title?: string; body?: string }) {
  return (
    <div className="rounded-card border border-lake-deep/30 bg-lake/15 p-5 text-on-paper" data-testid="i-dont-know">
      <p className="t-heading">{title ?? t(lang, "dontKnow")}</p>
      <p className="mt-1 mb-4 text-muted-paper">{body ?? t(lang, "dontKnowBody")}</p>
      <SearchBox lang={lang} />
    </div>
  );
}
export const DontKnow = IDontKnow;
