const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";
const DATA_DIR = path.join(__dirname, "data");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

const app = express();
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---------- tiny JSON-file storage ----------
async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

// Write to a temp file then rename, so a crash never leaves half-written JSON.
async function writeJson(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}

// Serialize writes to messages.json so two submissions can't overwrite each other.
let writeQueue = Promise.resolve();
function updateMessages(fn) {
  const next = writeQueue.then(async () => {
    const messages = await readJson(MESSAGES_FILE, []);
    const result = fn(messages);
    await writeJson(MESSAGES_FILE, messages);
    return result;
  });
  writeQueue = next.catch(() => {});
  return next;
}

// ---------- public API ----------
// Each of these is read fresh on every request, so editing a data file updates the site instantly.
for (const [route, file, fallback] of [
  ["/api/profile", "profile.json", {}],
  ["/api/experience", "experience.json", []],
  ["/api/certifications", "certifications.json", []],
]) {
  app.get(route, async (req, res, next) => {
    try {
      res.json(await readJson(path.join(DATA_DIR, file), fallback));
    } catch (err) {
      next(err);
    }
  });
}

app.get("/api/projects", async (req, res, next) => {
  try {
    const projects = await readJson(path.join(DATA_DIR, "projects.json"), []);
    const { category, tag } = req.query;
    res.json(
      projects.filter(
        (p) => (!category || p.category === category) && (!tag || p.tags?.includes(tag))
      )
    );
  } catch (err) {
    next(err);
  }
});

// Simple in-memory rate limit: 5 messages per IP per 10 minutes.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

app.post("/api/contact", async (req, res, next) => {
  try {
    const { name, email, message, website } = req.body || {};

    // "website" is a hidden honeypot field; real visitors leave it empty.
    if (website) return res.status(200).json({ ok: true });

    const errors = {};
    if (!name || String(name).trim().length < 2) errors.name = "Please enter your name.";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) errors.email = "Please enter a valid email.";
    if (!message || String(message).trim().length < 10) errors.message = "Message should be at least 10 characters.";
    if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

    if (rateLimited(req.ip)) {
      return res.status(429).json({ ok: false, error: "Too many messages. Please try again later." });
    }

    await updateMessages((messages) => {
      messages.unshift({
        id: crypto.randomUUID(),
        name: String(name).trim().slice(0, 100),
        email: String(email).trim().slice(0, 200),
        message: String(message).trim().slice(0, 5000),
        read: false,
        createdAt: new Date().toISOString(),
      });
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- admin API (password in the x-admin-password header) ----------
function requireAdmin(req, res, next) {
  const given = Buffer.from(String(req.get("x-admin-password") || ""));
  const expected = Buffer.from(ADMIN_PASSWORD);
  const ok = given.length === expected.length && crypto.timingSafeEqual(given, expected);
  if (!ok) return res.status(401).json({ ok: false, error: "Wrong password." });
  next();
}

app.get("/api/admin/messages", requireAdmin, async (req, res, next) => {
  try {
    res.json(await readJson(MESSAGES_FILE, []));
  } catch (err) {
    next(err);
  }
});

app.patch("/api/admin/messages/:id", requireAdmin, async (req, res, next) => {
  try {
    const found = await updateMessages((messages) => {
      const msg = messages.find((m) => m.id === req.params.id);
      if (msg) msg.read = Boolean(req.body?.read);
      return msg;
    });
    if (!found) return res.status(404).json({ ok: false, error: "Not found." });
    res.json({ ok: true, message: found });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/admin/messages/:id", requireAdmin, async (req, res, next) => {
  try {
    const removed = await updateMessages((messages) => {
      const i = messages.findIndex((m) => m.id === req.params.id);
      return i === -1 ? null : messages.splice(i, 1)[0];
    });
    if (!removed) return res.status(404).json({ ok: false, error: "Not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- errors ----------
app.use("/api", (req, res) => res.status(404).json({ ok: false, error: "Not found." }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Something went wrong on the server." });
});

app.listen(PORT, () => {
  console.log(`Portfolio running at http://localhost:${PORT}`);
  if (ADMIN_PASSWORD === "change-me") {
    console.warn("Warning: ADMIN_PASSWORD is still the default. Set it before deploying.");
  }
});
