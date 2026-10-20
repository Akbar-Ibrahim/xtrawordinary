import { z } from "zod";

export const gameReportInputSchema = z.object({
  gameSlug: z.string().min(1).max(100),
  message: z.string().max(5000, "Message cannot exceed 5,000 characters")
    .refine((message) => message.trim().length > 0, "Enter a message"),
  website: z.string().max(200).optional(),
});

export type GameReportInput = z.infer<typeof gameReportInputSchema>;

export type GameReport = {
  id: number;
  gameSlug: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

export type InsertGameReport = Pick<GameReport, "gameSlug" | "message">;
export type AdminGameReport = GameReport & { gameName: string };