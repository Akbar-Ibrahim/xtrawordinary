import { z } from "zod";

export const contactMessageInputSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120, "Name cannot exceed 120 characters"),
  email: z.string().trim().email("Enter a valid email address").max(255, "Email cannot exceed 255 characters"),
  subject: z.string().trim().max(160, "Subject cannot exceed 160 characters").optional(),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(5000, "Message cannot exceed 5,000 characters"),
  website: z.string().max(200).optional(),
});

export const contactReplyInputSchema = z.object({
  message: z.string().trim().min(1, "Reply cannot be empty").max(5000, "Reply cannot exceed 5,000 characters"),
});

export type ContactMessageInput = z.infer<typeof contactMessageInputSchema>;
export type ContactReplyInput = z.infer<typeof contactReplyInputSchema>;

export type InsertContactMessage = {
  name: string;
  email: string;
  subject?: string | null;
  message: string;
};

export type ContactMessage = {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  readAt: string | null;
  createdAt: string;
  replies: ContactMessageReply[];
};

export type ContactMessageReply = {
  id: number;
  contactMessageId: number;
  message: string;
  sentByAdminId: number;
  sentByAdminName: string;
  sentAt: string;
};

export type InsertContactMessageReply = Omit<ContactMessageReply, "id" | "sentAt">;
