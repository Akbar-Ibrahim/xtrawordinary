import type { Express } from "express";
import passport from "passport";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "../storage";
import { sendVerificationEmail, sendPasswordResetEmail } from "../email";
import { registerSchema, loginSchema } from "../validators";
import { authLimiter, passwordLimiter } from "../middleware/security";
import { normalizeUsername, validateUsername } from "@shared/usernames";
import {
  isPendingGoogleSignup,
  PENDING_GOOGLE_SIGNUP_SESSION_KEY,
  type PendingGoogleSignup,
} from "../auth";

function sanitizeUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.name,
    username: user.username,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    isAdmin: user.isAdmin,
    isPremium: user.isPremium,
    createdAt: user.createdAt,
  };
}

export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      const { email, username, password } = parsed.data;
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }
      const usernameNormalized = normalizeUsername(username);
      if (await storage.getUserByUsername(usernameNormalized)) {
        return res.status(409).json({ error: "That username is already taken" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const noEmailService = !process.env.RESEND_API_KEY;
      const user = await storage.createUser({
        email,
        name: usernameNormalized,
        username: usernameNormalized,
        usernameNormalized,
        passwordHash,
        googleId: null,
        emailVerified: noEmailService,
        avatarUrl: null,
        isAdmin: !!(process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase()),
        isBanned: false,
        isPremium: false,
      });
      if (!noEmailService) {
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await storage.createEmailVerificationToken(user.id, token, expiresAt);
        await sendVerificationEmail(email, token);
      }
      const message = noEmailService
        ? "Registration successful."
        : "Registration successful. Please verify your email.";
      res.status(201).json({ user: sanitizeUser(user), message });
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "That username or email is already registered" });
      }
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", authLimiter, (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info?.message || "Login failed" });
      }
      req.logIn(user, (err) => {
        if (err) return next(err);
        const rememberMe = req.body.rememberMe === true;
        req.session.cookie.maxAge = rememberMe
          ? 30 * 24 * 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;
        res.json({ user: sanitizeUser(user) });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      res.json({ user: sanitizeUser(req.user) });
    } else {
      res.json({ user: null });
    }
  });

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

    app.get("/api/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/?auth=error", session: false }),
      (req, res, next) => {
        if (isPendingGoogleSignup(req.user)) {
          (req.session as any)[PENDING_GOOGLE_SIGNUP_SESSION_KEY] = req.user;
          return req.session.save((err) => {
            if (err) return next(err);
            res.redirect("/?auth=google-new");
          });
        }

        req.logIn(req.user!, (err) => {
          if (err) return next(err);
          res.redirect("/?auth=success");
        });
      }
    );

    app.get("/api/auth/google/pending", (req, res) => {
      const pending = (req.session as any)[PENDING_GOOGLE_SIGNUP_SESSION_KEY] as PendingGoogleSignup | undefined;
      if (!isPendingGoogleSignup(pending)) {
        return res.status(404).json({ error: "No pending Google signup" });
      }
      res.json({ name: pending.name, avatarUrl: pending.avatarUrl });
    });

    app.post("/api/auth/google/complete", authLimiter, async (req, res, next) => {
      try {
        const pending = (req.session as any)[PENDING_GOOGLE_SIGNUP_SESSION_KEY] as PendingGoogleSignup | undefined;
        if (!isPendingGoogleSignup(pending)) {
          return res.status(400).json({ error: "No pending Google signup" });
        }

        const requestedUsername = String(req.body?.username || "");
        const validationError = validateUsername(requestedUsername);
        if (validationError) {
          return res.status(400).json({ error: validationError });
        }

        const username = normalizeUsername(requestedUsername);
        const existingUsername = await storage.getUserByUsername(username);
        if (existingUsername && existingUsername.id !== pending.existingUserId) {
          return res.status(409).json({ error: "That username is already taken" });
        }

        let user;
        if (pending.existingUserId !== undefined) {
          const existingUser = await storage.getUserById(pending.existingUserId);
          if (!existingUser || existingUser.googleId !== pending.googleId) {
            return res.status(400).json({ error: "This Google signup is no longer available" });
          }
          user = await storage.updateUser(existingUser.id, {
            username,
            usernameNormalized: username,
          });
        } else {
          const existingGoogleUser = await storage.getUserByGoogleId(pending.googleId);
          if (existingGoogleUser) {
            return res.status(409).json({ error: "This Google account is already registered" });
          }

          const existingEmailUser = await storage.getUserByEmail(pending.email);
          if (existingEmailUser) {
            return res.status(409).json({ error: "This email is already registered" });
          }

          const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
          user = await storage.createUser({
            email: pending.email,
            name: pending.name,
            username,
            usernameNormalized: username,
            passwordHash: null,
            googleId: pending.googleId,
            emailVerified: true,
            avatarUrl: pending.avatarUrl,
            isAdmin: !!(adminEmail && pending.email.toLowerCase() === adminEmail),
            isBanned: false,
            isPremium: false,
          });
        }

        if (!user) {
          return res.status(400).json({ error: "Unable to complete Google signup" });
        }

        delete (req.session as any)[PENDING_GOOGLE_SIGNUP_SESSION_KEY];
        req.logIn(user, (err) => {
          if (err) return next(err);
          res.status(201).json({ user: sanitizeUser(user) });
        });
      } catch (error: any) {
        if (error?.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ error: "That username or email is already registered" });
        }
        next(error);
      }
    });
  }

  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Token is required" });
      const record = await storage.getEmailVerificationToken(token);
      if (!record) return res.status(400).json({ error: "Invalid or expired token" });
      if (new Date(record.expiresAt) < new Date()) {
        await storage.deleteEmailVerificationToken(token);
        return res.status(400).json({ error: "Token has expired" });
      }
      await storage.updateUser(record.userId, { emailVerified: true });
      await storage.deleteEmailVerificationToken(token);
      res.json({ message: "Email verified successfully" });
    } catch (error) {
      res.status(500).json({ error: "Verification failed" });
    }
  });

  app.post("/api/auth/forgot-password", passwordLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ message: "If that email is registered, a reset link has been sent." });
      }
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await storage.createPasswordResetToken(user.id, token, expiresAt);
      await sendPasswordResetEmail(email, token);
      res.json({ message: "If that email is registered, a reset link has been sent." });
    } catch (error) {
      res.status(500).json({ error: "Request failed" });
    }
  });

  app.post("/api/auth/reset-password", passwordLimiter, async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) return res.status(400).json({ error: "Token and password are required" });
      if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
      const record = await storage.getPasswordResetToken(token);
      if (!record) return res.status(400).json({ error: "Invalid or expired token" });
      if (new Date(record.expiresAt) < new Date()) {
        await storage.deletePasswordResetToken(token);
        return res.status(400).json({ error: "Token has expired" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      await storage.updateUser(record.userId, { passwordHash });
      await storage.deletePasswordResetToken(token);
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      res.status(500).json({ error: "Reset failed" });
    }
  });
}
