import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { RequestHandler } from "express";
import MySQLStoreFactory from "express-mysql-session";
import bcrypt from "bcryptjs";
import type { Express } from "express";
import { storage } from "./storage";
import { isMySQLStorageEnabled } from "./storage-config";

let _sessionMiddleware: RequestHandler | null = null;

export function getSessionMiddleware(): RequestHandler {
  if (!_sessionMiddleware) throw new Error("Session middleware not yet initialised — call setupAuth first");
  return _sessionMiddleware;
}

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      name: string;
      passwordHash: string | null;
      googleId: string | null;
      emailVerified: boolean;
      avatarUrl: string | null;
      isAdmin: boolean;
      isBanned: boolean;
      isPremium: boolean;
      createdAt: string;
    }
  }
}

export async function maybePromoteToAdmin(user: Express.User): Promise<Express.User> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail && user.email.toLowerCase() === adminEmail && !user.isAdmin) {
    await storage.updateUser(user.id, { isAdmin: true });
    return { ...user, isAdmin: true };
  }
  return user;
}

export function setupAuth(app: Express) {
  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
    console.error("[Session] WARNING: SESSION_SECRET is not set in production! Using insecure fallback.");
  }

  const sessionOptions: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "wordplay-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  };

  const mysqlUrl = process.env.MYSQL_DATABASE_URL;
  if (isMySQLStorageEnabled()) {
    try {
      if (!mysqlUrl) {
        throw new Error("MYSQL_DATABASE_URL is required when STORAGE_MODE=mysql");
      }
      const MySQLStore = MySQLStoreFactory(session as any);
      const url = new URL(mysqlUrl);
      const store = new MySQLStore({
        host: url.hostname,
        port: parseInt(url.port) || 3306,
        user: url.username,
        password: url.password,
        database: url.pathname.replace("/", ""),
        createDatabaseTable: true,
        checkExpirationInterval: 15 * 60 * 1000,
        expiration: 30 * 24 * 60 * 60 * 1000,
        schema: {
          tableName: "sessions",
          columnNames: {
            session_id: "session_id",
            expires: "expires",
            data: "data",
          },
        },
      });
      sessionOptions.store = store;
      console.log("[Session] Using MySQL session store for persistent sessions");
    } catch (err) {
      console.error("[Session] Failed to create MySQL session store, falling back to memory:", err);
    }
  } else {
    console.log("[Session] Using in-memory session store (sessions won't persist across restarts)");
  }

  _sessionMiddleware = session(sessionOptions);
  app.use(_sessionMiddleware);

  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user || undefined);
    } catch (err) {
      done(err);
    }
  });

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }
          if (!user.passwordHash) {
            return done(null, false, { message: "Please sign in with Google" });
          }
          if (!user.emailVerified) {
            return done(null, false, { message: "Please verify your email first" });
          }
          if (user.isBanned) {
            return done(null, false, { message: "Your account has been suspended" });
          }
          const isMatch = await bcrypt.compare(password, user.passwordHash);
          if (!isMatch) {
            return done(null, false, { message: "Invalid email or password" });
          }
          return done(null, await maybePromoteToAdmin(user));
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (googleClientId && googleClientSecret) {
    const callbackURL = process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback";
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL,
          passReqToCallback: true,
        } as any,
        async (req: any, _accessToken: string, _refreshToken: string, profile: any, done: any) => {
          try {
            let user = await storage.getUserByGoogleId(profile.id);
            if (user) {
              if (user.isBanned) {
                return done(null, false, { message: "Your account has been suspended" } as any);
              }
              return done(null, await maybePromoteToAdmin(user));
            }

            const email = profile.emails?.[0]?.value;
            if (email) {
              user = await storage.getUserByEmail(email);
              if (user) {
                if (user.isBanned) {
                  return done(null, false, { message: "Your account has been suspended" } as any);
                }
                await storage.updateUser(user.id, { googleId: profile.id, emailVerified: true });
                const updated = await storage.getUserById(user.id);
                return done(null, await maybePromoteToAdmin(updated || user));
              }
            }

            const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
            user = await storage.createUser({
              email: email || `${profile.id}@google.oauth`,
              name: profile.displayName || "Google User",
              passwordHash: null,
              googleId: profile.id,
              emailVerified: true,
              avatarUrl: profile.photos?.[0]?.value || null,
              isAdmin: !!(adminEmail && email && email.toLowerCase() === adminEmail),
              isBanned: false,
              isPremium: false,
            });
            req.session.isNewGoogleUser = true;
            return done(null, user);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
  } else {
    console.log("[Auth] Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable.");
  }
}

export function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Authentication required" });
}

export function requireAdmin(req: any, res: any, next: any) {
  if (req.isAuthenticated() && req.user?.isAdmin) {
    return next();
  }
  res.status(403).json({ error: "Admin access required" });
}
