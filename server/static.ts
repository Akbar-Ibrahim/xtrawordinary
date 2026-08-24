import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { injectMetaTags } from "./seo";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Cache the HTML template in memory — read from disk once, then reuse.
  let cachedTemplate: string | null = null;

  // Fall through to index.html for all client-side routes, injecting
  // server-side SEO meta tags so crawlers see the correct title and description
  // without needing to execute JavaScript.
  app.use("*", async (req, res) => {
    try {
      if (!cachedTemplate) {
        cachedTemplate = await fs.promises.readFile(
          path.resolve(distPath, "index.html"),
          "utf-8",
        );
      }
      const html = injectMetaTags(cachedTemplate, req.originalUrl);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch {
      res.status(500).send("Internal server error");
    }
  });
}
