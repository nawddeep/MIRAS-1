"use client";

import { useEffect, useState } from "react";

export function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState("overview");
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: "-90px 0px -55% 0px" });
    for (const section of sections) {
      if (section.id === "photos") continue;
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [sections]);
  return <nav aria-label="Sections" className="place-section-nav"><ul>{sections.map(section => <li key={section.id}><a href={`#${section.id}`} aria-current={active === section.id ? "location" : undefined} onClick={() => setActive(section.id)}>{section.label}</a></li>)}</ul></nav>;
}
