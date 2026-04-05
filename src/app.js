require("dotenv").config();

/** 改代码后 bump，在 Railway 日志里核对是否拉到新镜像 */
const DEPLOY_TAG = "boot-2026-04-05-v5-railway-port-hint";
console.log(`[boot] DEPLOY_TAG=${DEPLOY_TAG}`);

const http = require("http");
const express = require("express");
const cors = require("cors");

/**
 * Railway / Render 等平台会注入 PORT，必须原样监听该端口。
 * 注意：Number("") === 0，用 || 3001 会误用 3001 导致网关 connection refused。
 */
function resolvePort() {
  const raw = process.env.PORT;
  if (raw === undefined || raw === "") return 3001;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0 || n > 65535) {
    console.error("[boot] Invalid PORT env:", JSON.stringify(raw));
    process.exit(1);
  }
  return n;
}

const PORT = resolvePort();
// 公网部署必须监听 0.0.0.0，否则容器外（网关）连不上进程
const HOST = process.env.HOST || "0.0.0.0";

console.log(
  "[boot] NODE_ENV=%s PORT=%s (env raw: %s) HOST=%s",
  process.env.NODE_ENV || "(unset)",
  PORT,
  process.env.PORT === undefined ? "(unset)" : JSON.stringify(process.env.PORT),
  HOST
);

if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) {
  console.warn(
    `[boot] Railway: Settings → Networking 里公网入口的「Port / Target」必须是 ${PORT}（与日志里 PORT 一致）。若写成 3001 而应用在 ${PORT} 监听，会出现 502 / connection refused。`
  );
}

const chatRouter = require("./routes/chat");
const stories = require("../data/stories.json");

const app = express();

// 反向代理后拿到真实协议/主机（Zeabur / Railway / Nginx 等）
app.set("trust proxy", 1);

// 平台健康检查：放在 CORS 之前。Railway 等常用 HEAD 探活，仅 app.get 不会响应 HEAD → 404 → 502
function healthOk(_req, res) {
  res.status(200).set("Cache-Control", "no-store");
}
app.get("/health", (req, res) => {
  healthOk(req, res);
  res.type("text/plain").send("ok");
});
app.head("/health", (req, res) => {
  healthOk(req, res);
  res.end();
});
app.options("/health", (_req, res) => {
  res.sendStatus(204);
});

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

server.on("listening", () => {
  const addr = server.address();
  console.log("[boot] server.address() =", addr);
});

server.listen(PORT, HOST, () => {
  console.log(`
  Server listening on ${HOST}:${PORT}
  Allowed CORS origins: ${allowedOrigins.join(", ") || "(none)"}

  GET/HEAD /health  -> 健康检查（Railway 常用 HEAD）
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
