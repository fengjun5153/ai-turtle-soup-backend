require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const chatRouter = require("./routes/chat");
const stories = require("../data/stories.json");

const app = express();
const PORT = Number(process.env.PORT) || 3001;
// 公网部署必须监听 0.0.0.0，否则容器外（网关）连不上进程
const HOST = process.env.HOST || "0.0.0.0";

// 反向代理后拿到真实协议/主机（Zeabur / Railway / Nginx 等）
app.set("trust proxy", 1);

// 支持多个前端域名：CLIENT_ORIGIN=https://a.com,https://b.com
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, "");
      if (allowedOrigins.includes(normalized)) return callback(null, true);
      console.warn(`[cors] blocked origin: ${origin}`);
      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 204,
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

server.listen(PORT, HOST, () => {
  console.log(`
  Server listening on ${HOST}:${PORT}
  Allowed CORS origins: ${allowedOrigins.join(", ") || "(none)"}

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
