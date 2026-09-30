import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createServer } from "vite";

process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING = "true";

test("generated dashboard HTML uses Green Fleet as the browser title", async () => {
  const server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });

  try {
    const source = await readFile("index.html", "utf8");
    const html = await server.transformIndexHtml("/", source);

    assert.match(html, /<title>Green Fleet<\/title>/);
  } finally {
    await server.close();
  }
});
