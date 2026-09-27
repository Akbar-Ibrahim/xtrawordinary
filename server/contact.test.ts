import assert from "node:assert/strict";
import test from "node:test";
import { contactMessageInputSchema, contactReplyInputSchema } from "@shared/schema";
import { MemStorage } from "./mem-storage";

test("contact message validation accepts valid input and trims fields", () => {
  const result = contactMessageInputSchema.parse({
    name: "  Ada Lovelace  ",
    email: "  ada@example.com  ",
    subject: "  Game feedback  ",
    message: "  I really enjoy the daily challenge.  ",
    website: "",
  });

  assert.equal(result.name, "Ada Lovelace");
  assert.equal(result.email, "ada@example.com");
  assert.equal(result.subject, "Game feedback");
  assert.equal(result.message, "I really enjoy the daily challenge.");
});

test("contact message validation rejects invalid email and short messages", () => {
  const result = contactMessageInputSchema.safeParse({
    name: "Ada Lovelace",
    email: "not-an-email",
    message: "Too short",
  });

  assert.equal(result.success, false);
});

test("contact reply validation trims content and rejects empty replies", () => {
  assert.equal(contactReplyInputSchema.parse({ message: "  Thanks for writing!  " }).message, "Thanks for writing!");
  assert.equal(contactReplyInputSchema.safeParse({ message: "   " }).success, false);
});

test("in-memory contact inbox stores newest first and marks messages read", async () => {
  const storage = new MemStorage();
  const first = await storage.createContactMessage({
    name: "First Sender",
    email: "first@example.com",
    message: "This is the first contact message.",
  });
  const second = await storage.createContactMessage({
    name: "Second Sender",
    email: "second@example.com",
    subject: "Second subject",
    message: "This is the second contact message.",
  });

  assert.deepEqual((await storage.getContactMessages()).map((message) => message.id), [second.id, first.id]);
  assert.equal(await storage.markContactMessageRead(first.id), true);
  assert.ok((await storage.getContactMessages()).find((message) => message.id === first.id)?.readAt);
  assert.equal(await storage.markContactMessageRead(999), false);

  const reply = await storage.createContactMessageReply({
    contactMessageId: first.id,
    message: "Thanks for your feedback.",
    sentByAdminId: 7,
    sentByAdminName: "Admin",
  });
  const stored = await storage.getContactMessage(first.id);
  assert.equal(stored?.replies[0].id, reply.id);
  assert.equal(stored?.replies[0].sentByAdminName, "Admin");
});