import { z } from "zod";

export const ParsedNoticeSchema = z.object({
  train: z.string().min(1),
  station: z.string().min(2),
  expectedTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().nullable(),
});

export type ParsedNotice = z.infer<typeof ParsedNoticeSchema>;