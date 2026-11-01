import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResponsibleInfo } from "@/components/ResponsibleInfo";
import { place } from "./helpers";

const render = (over: Parameters<typeof place>[0]) => renderToStaticMarkup(createElement(ResponsibleInfo, { place: place(over), lang: "en" }));

describe("responsible and accessible tourism fields", () => {
  it("unverified accessibility shows 'Not yet verified' and no claim", () => {
    const html = render({ accessibility: { stepFree: "yes", notes: "Ramp at the east gate" } });
    expect(html).toContain("Not yet verified");
    expect(html).not.toContain("Step-free access: yes");
    expect(html).not.toContain("Ramp at the east gate");
  });

  it("verified accessibility shows the claim and who checked it", () => {
    const html = render({ accessibility: { stepFree: "yes", notes: "Ramp at the east gate", verifiedBy: "A. Checker", verifiedAt: "2026-10-28T00:00:00.000Z" } });
    expect(html).toContain("Step-free access: yes");
    expect(html).toContain("A. Checker");
  });

  it("a blank verifiedBy counts as unverified", () => {
    expect(render({ accessibility: { stepFree: "no", verifiedBy: "  " } })).not.toContain("Step-free access");
  });

  it("only checked etiquette, conservation and photography notes render", () => {
    const html = render({
      etiquette: [{ text: "Checked etiquette", verifiedBy: "B" }, { text: "Unchecked etiquette" }],
      conservation: [{ text: "Unchecked conservation" }],
      photographyRules: { text: "Unchecked photo rule" },
    });
    expect(html).toContain("Checked etiquette");
    expect(html).not.toContain("Unchecked etiquette");
    expect(html).not.toContain("Unchecked conservation");
    expect(html).not.toContain("Unchecked photo rule");
  });

  it("never uses certification wording", () => {
    const html = render({ accessibility: { stepFree: "yes", verifiedBy: "C" }, etiquette: [{ text: "x", verifiedBy: "C" }] });
    expect(html).not.toMatch(/certif|accredit|guarantee/i);
  });

  it("renders nothing when a place has none of these fields", () => {
    expect(render({})).toBe("");
  });
});
