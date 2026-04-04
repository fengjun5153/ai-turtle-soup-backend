require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const chatRouter = require("./routes/chat");
const stories = require("../data/stories.json");

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

// --- Request logger ---
app.use((req, _res, next) => {
  console.log(`[req] ${req.method} ${req.path}`);
  next();
});

// --- Routes ---
app.use("/api/chat", chatRouter);

app.get("/api/stories", (_req, res) => {
  const safeList = stories.map(({ truth, ...meta }) => meta);
  res.json({ ok: true, data: safeList });
});

app.get("/api/test", (_req, res) => {
  res.json({
    ok: true,
    message: "Backend is running.",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (_req, res) => {
  res.json({ ok: true, message: "AI Turtle Soup backend service" });
});

const server = http.createServer(app);

server.listen(PORT, () => {
  const host = `http://localhost:${PORT}`;
  console.log(`
  Server is running at ${host}

  GET  /            -> 服务信息
  GET  /api/test    -> 测试
  GET  /api/stories -> 题库列表（不含汤底）
  POST /api/chat    -> AI 对话
  `);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[server] Port ${PORT} is already in use. Kill the old process first.`);
  } else {
    console.error("[server] Failed to start:", err);
  }
  process.exit(1);
});
