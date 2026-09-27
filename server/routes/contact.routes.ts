import type { Express } from "express";
import { contactMessageInputSchema, contactReplyInputSchema } from "@shared/schema";
import { requireAdmin } from "../auth";
import { contactLimiter } from "../middleware/security";
import { storage } from "../storage";
import { sendContactReply } from "../services/email";

export function registerContactRoutes(app: Express): void {
  app.post("/api/contact", contactLimiter, async (req, res) => {
    try {
      if (typeof req.body?.website === "string" && req.body.website.trim()) {
        return res.status(201).json({ ok: true });
      }

      const parsed = contactMessageInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message ?? "Invalid contact message",
        });
      }

      const contactMessage = await storage.createContactMessage({
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        subject: parsed.data.subject || null,
        message: parsed.data.message,
      });
      res.status(201).json({ ok: true, id: contactMessage.id });
    } catch {
      res.status(500).json({ error: "Failed to send your message" });
    }
  });

  app.get("/api/admin/contact-messages", requireAdmin, async (_req, res) => {
    try {
      res.json(await storage.getContactMessages());
    } catch {
      res.status(500).json({ error: "Failed to fetch contact messages" });
    }
  });

  app.patch("/api/admin/contact-messages/:id/read", requireAdmin, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid contact message ID" });
      }
      const found = await storage.markContactMessageRead(id);
      if (!found) return res.status(404).json({ error: "Contact message not found" });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Failed to mark contact message as read" });
    }
  });

  app.post("/api/admin/contact-messages/:id/replies", requireAdmin, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid contact message ID" });
      }
      const parsed = contactReplyInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid reply" });
      }

      const contactMessage = await storage.getContactMessage(id);
      if (!contactMessage) return res.status(404).json({ error: "Contact message not found" });

      const delivered = await sendContactReply(
        contactMessage.email,
        contactMessage.subject,
        parsed.data.message,
      );
      if (!delivered) {
        return res.status(502).json({ error: "The reply could not be delivered. Please try again." });
      }

      const reply = await storage.createContactMessageReply({
        contactMessageId: id,
        message: parsed.data.message,
        sentByAdminId: req.user!.id,
        sentByAdminName: req.user!.name,
      });
      res.status(201).json(reply);
    } catch {
      res.status(500).json({ error: "Failed to send reply" });
    }
  });
}
