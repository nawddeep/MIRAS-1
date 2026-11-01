import crypto from "node:crypto";
import { z } from "zod";
import type { Workshop } from "@/lib/schemas";
import { saveWorkshop } from "./publishing";

export const WorkshopEdit = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1500),
  language: z.string().trim().min(1).max(80),
  durationMinutes: z.coerce.number().int().min(15).max(24 * 60),
  cost: z.string().trim().min(1).max(80),
  howToBook: z.string().trim().min(1).max(300),
});
export type WorkshopEdit = z.infer<typeof WorkshopEdit>;

/** Any edit sends the workshop back to draft and clears the confirmation: changed details need confirming again. */
export function saveWorkshopDraft(artisanId: string, existing: Workshop | undefined, edit: WorkshopEdit, now = new Date()): Workshop {
  return saveWorkshop({
    id: existing?.id ?? `ws-${crypto.randomBytes(4).toString("hex")}`,
    artisanId,
    ...edit,
    status: "draft",
    confirmedByOwnerAt: undefined,
    updatedAt: now.toISOString(),
    isSample: existing?.isSample ?? false,
  });
}

/** The owner ticks "these details are correct" and publishes. The gate in publishing.ts still decides. */
export function confirmAndPublishWorkshop(w: Workshop, now = new Date()): Workshop {
  return saveWorkshop({ ...w, confirmedByOwnerAt: now.toISOString(), status: "published", updatedAt: now.toISOString() });
}

export function unpublishWorkshop(w: Workshop, now = new Date()): Workshop {
  return saveWorkshop({ ...w, status: "draft", updatedAt: now.toISOString() });
}
