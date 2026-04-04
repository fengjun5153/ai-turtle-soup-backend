# AI 海龟汤——真相迷雾 (The Fog of Truth)
## 完整技术设计文档 v3.0 · 前后端分离版

> **版本说明**：本文档基于 v2.0 重构版进行最终优化，采用 **前后端完全分离** 架构（独立 Express 后端 + React 前端），替换原 Next.js All-in-One 方案，以便独立部署、水平扩展与团队协作开发。

---

## 目录

1. [架构总览](#1-架构总览)
2. [目录结构](#2-目录结构)
3. [后端设计（Express + Node.js）](#3-后端设计)
4. [前端设计（React + TypeScript）](#4-前端设计)
5. [数据结构与类型定义](#5-数据结构与类型定义)
6. [API 接口规范](#6-api-接口规范)
7. [AI 引擎与 Prompt 工程](#7-ai-引擎与-prompt-工程)
8. [上下文管理策略](#8-上下文管理策略)
9. [游戏机制实现](#9-游戏机制实现)
10. [题库系统](#10-题库系统)
11. [安全设计](#11-安全设计)
12. [性能优化](#12-性能优化)
13. [环境配置与部署](#13-环境配置与部署)
14. [开发路线图](#14-开发路线图)
15. [附录：Agent 指令集](#15-附录agent-指令集)

---

## 1. 架构总览

### 1.1 整体分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        客户端 (Browser)                          │
│              React + TypeScript + Vite + Tailwind CSS            │
│         UI渲染 / 游戏状态管理 / LocalStorage持久化               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP / SSE
                            │ CORS受控
┌───────────────────────────▼─────────────────────────────────────┐
│                     后端中转层 (Server)                          │
│              Express.js + Node.js + TypeScript                   │
│     API Key隔离 / Prompt注入 / 限流 / 上下文裁剪 / 降级策略      │
└──────────────┬────────────────────────────┬─────────────────────┘
               │                            │
┌──────────────▼──────────┐    ┌───────────▼──────────────────────┐
│      AI 引擎             │    │         存储层                   │
│  DeepSeek Chat (主)      │    │  Redis (游戏会话 + 题库 + 限流)  │
│  Claude Haiku 3.5 (备)   │    │  可替换: Upstash / 本地 JSON     │
└─────────────────────────┘    └──────────────────────────────────┘
```

### 1.2 前后端分离的优势

| 维度 | Next.js 方案 | 前后端分离方案 |
|------|-------------|--------------|
| 部署灵活性 | 强绑定 Vercel | 后端可部署于任意 Node 环境 |
| 团队协作 | 前后端耦合 | 独立开发、独立 PR |
| 水平扩展 | 受 Vercel 限制 | 后端可独立弹性伸缩 |
| 本地开发 | 较重 | 前后端各自 `npm run dev` |
| AI 流式传输 | Edge 50ms CPU 限制 | Node.js 无超时限制 |

### 1.3 技术选型汇总

| 层次 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 18 + TypeScript + Vite | 轻量快速，脱离 Next.js |
| 前端样式 | Tailwind CSS | 不变 |
| 前端状态 | React Context + useReducer | 状态转换可预测 |
| 后端框架 | Express.js + Node.js 20 | 轻量、中间件生态丰富 |
| AI 主力 | DeepSeek Chat | 推理强、成本极低 |
| AI 备用 | Claude Haiku 3.5 | 降级保障 |
| 会话存储 | Redis（Upstash 托管） | 支持 TTL、原子限流 |
| 流式传输 | Server-Sent Events (SSE) | 替代轮询，低延迟 |
| 前后端通信 | REST + SSE | 标准 HTTP |
| 部署 | 后端: Railway/Render/VPS，前端: Vercel/Netlify | 独立部署 |

---

## 2. 目录结构

### 2.1 Monorepo 总览

```
fog-of-truth/
├── packages/
│   ├── server/                # 后端（Express）
│   └── client/                # 前端（React + Vite）
├── packages/shared/           # 共享类型定义
├── package.json               # Workspace 配置
├── .env.example               # 环境变量模板
└── docker-compose.yml         # 本地开发容器
```

### 2.2 后端目录结构

```
packages/server/
├── src/
│   ├── routes/
│   │   ├── game.ts            # /api/game/* 路由
│   │   └── stories.ts         # /api/stories 路由
│   ├── services/
│   │   ├── ai/
│   │   │   ├── judge.ts       # 裁判判定逻辑
│   │   │   ├── generator.ts   # 题目生成逻辑
│   │   │   ├── scorer.ts      # 最终评分逻辑
│   │   │   └── fallback.ts    # 降级策略
│   │   ├── game.service.ts    # 游戏会话管理
│   │   ├── story.service.ts   # 题库服务
│   │   └── redis.service.ts   # Redis 操作封装
│   ├── middleware/
│   │   ├── rateLimit.ts       # IP 限流
│   │   ├── validation.ts      # 入参校验
│   │   └── errorHandler.ts    # 统一错误处理
│   ├── prompts/
│   │   ├── judge.prompt.ts    # 裁判 System Prompt
│   │   └── generator.prompt.ts # 生成器 Prompt
│   ├── lib/
│   │   ├── sanitize.ts        # 输入清洗（防注入）
│   │   └── uuid.ts            # gameId 生成
│   ├── config.ts              # 配置中心
│   └── app.ts                 # Express 应用入口
├── data/
│   └── builtin-stories.json   # 内置题库（10+ 条）
├── tsconfig.json
└── package.json
```

### 2.3 前端目录结构

```
packages/client/
├── src/
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── MessageList.tsx     # 对话气泡列表
│   │   │   ├── MessageBubble.tsx   # 单条消息气泡
│   │   │   └── InputArea.tsx       # 提问输入 + 发送
│   │   ├── Game/
│   │   │   ├── FogOverlay.tsx      # 迷雾滤镜
│   │   │   ├── SanityBar.tsx       # 理智值进度条
│   │   │   ├── EvidencePanel.tsx   # 已确认线索侧边栏
│   │   │   ├── SolveModal.tsx      # 最终推断提交界面
│   │   │   └── GameOver.tsx        # 理智归零结束界面
│   │   └── Shared/
│   │       ├── MysteryCard.tsx     # 汤面卡片
│   │       ├── DifficultyBadge.tsx # 难度标签
│   │       └── LoadingDots.tsx     # 等待动画
│   ├── hooks/
│   │   ├── useGame.ts              # 核心游戏逻辑
│   │   ├── usePersist.ts           # LocalStorage 持久化
│   │   └── useSSE.ts               # SSE 连接管理
│   ├── context/
│   │   ├── GameContext.tsx         # 游戏状态上下文
│   │   └── GameReducer.ts          # useReducer 状态机
│   ├── lib/
│   │   ├── api.ts                  # fetch 封装（统一错误处理）
│   │   └── mistCalc.ts             # mistLevel 计算函数
│   ├── types/
│   │   └── index.ts                # 前端类型（复用 shared）
│   ├── pages/
│   │   ├── Home.tsx                # 首页 + 题目选择
│   │   └── Game.tsx                # 游戏主界面
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── sounds/                     # 音效资源
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## 3. 后端设计

### 3.1 Express 应用入口

```typescript
// packages/server/src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { gameRouter } from './routes/game';
import { storiesRouter } from './routes/stories';
import { errorHandler } from './middleware/errorHandler';
import { config } from './config';

const app = express();

// 安全头
app.use(helmet());

// CORS：仅允许前端域名
app.use(cors({
  origin: config.CLIENT_ORIGIN, // 'http://localhost:5173' (dev) | 'https://your-app.vercel.app' (prod)
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '10kb' })); // 防超大请求体

// 路由挂载
app.use('/api/game', gameRouter);
app.use('/api/stories', storiesRouter);

// 统一错误处理（放在最后）
app.use(errorHandler);

app.listen(config.PORT, () => {
  console.log(`[server] Running on port ${config.PORT}`);
});

export { app };
```

### 3.2 配置中心

```typescript
// packages/server/src/config.ts
export const config = {
  PORT: process.env.PORT || 3001,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  // AI Keys（绝不暴露给客户端）
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY!,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // 游戏配置
  GAME_SESSION_TTL: 24 * 60 * 60,      // 24小时（秒）
  MAX_QUESTIONS_PER_MINUTE: 30,          // IP 限流
  MAX_QUESTION_LENGTH: 200,              // 提问最大字数
  DIALOGUE_WINDOW_SIZE: 8,               // 滑动窗口轮数

  // AI 超时
  AI_TIMEOUT_MS: 8000,                   // 超时后降级
} as const;
```

### 3.3 游戏路由

```typescript
// packages/server/src/routes/game.ts
import { Router, Request, Response } from 'express';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { validateQuestion } from '../middleware/validation';
import { gameService } from '../services/game.service';
import { judgeAI } from '../services/ai/judge';
import { scorerAI } from '../services/ai/scorer';
import { AppError } from '../middleware/errorHandler';

export const gameRouter = Router();

// POST /api/game/init — 开始新游戏
gameRouter.post('/init', async (req: Request, res: Response) => {
  const { storyId, difficulty = 'normal' } = req.body;
  const session = await gameService.createSession({ storyId, difficulty });

  // ⚠️ 绝不返回 truth 字段
  res.json({
    ok: true,
    data: {
      gameId: session.gameId,
      storyId: session.storyId,
      surface: session.surface,
      title: session.title,
      difficulty: session.difficulty,
      evidenceThreshold: session.evidenceThreshold,
    }
  });
});

// POST /api/game/ask — 提交提问（SSE 流式响应）
gameRouter.post('/ask', rateLimitMiddleware, validateQuestion, async (req: Request, res: Response) => {
  const { gameId, question } = req.body;

  const session = await gameService.getSession(gameId);
  if (!session) throw new AppError('INVALID_GAME_ID', 'Game session not found or expired');
  if (session.phase !== 'playing') throw new AppError('GAME_OVER', 'This game has ended');

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // 调用 AI 裁判（支持流式）
  const result = await judgeAI.judge({
    session,
    question,
    onChunk: (chunk) => {
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
    }
  });

  // 更新会话状态
  const updatedSession = await gameService.processJudgeResult(gameId, question, result);

  // 发送最终结果事件
  res.write(`data: ${JSON.stringify({
    type: 'result',
    answer: result.answer,
    isNewEvidence: result.isNewEvidence,
    sanityDelta: result.sanityDelta,
  })}\n\n`);

  res.write('data: [DONE]\n\n');
  res.end();
});

// POST /api/game/solve — 提交最终推断
gameRouter.post('/solve', async (req: Request, res: Response) => {
  const { gameId, guess } = req.body;
  if (!gameId || !guess?.trim()) throw new AppError('INVALID_QUESTION', 'Guess cannot be empty');

  const session = await gameService.getSession(gameId);
  if (!session) throw new AppError('INVALID_GAME_ID', 'Game session not found');

  const evaluation = await scorerAI.evaluate({ session, guess });
  await gameService.endSession(gameId, evaluation.solved ? 'solved' : 'revealed');

  res.json({ ok: true, data: evaluation });
});

// GET /api/game/state — 恢复会话（前端刷新后调用）
gameRouter.get('/state', async (req: Request, res: Response) => {
  const { gameId } = req.query as { gameId: string };
  if (!gameId) throw new AppError('INVALID_GAME_ID', 'gameId is required');

  const session = await gameService.getSession(gameId);
  if (!session) throw new AppError('INVALID_GAME_ID', 'Game session not found or expired');

  // 返回客户端可见状态（不包含 truth）
  res.json({
    ok: true,
    data: {
      gameId: session.gameId,
      phase: session.phase,
      surface: session.surface,
      difficulty: session.difficulty,
      evidenceThreshold: session.evidenceThreshold,
      evidence: session.evidence,
      sanity: session.sanity,
      questionCount: session.questionCount,
    }
  });
});
```

### 3.4 游戏会话服务

```typescript
// packages/server/src/services/game.service.ts
import { redisService } from './redis.service';
import { storyService } from './story.service';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';
import type { GameSession, JudgeResult } from '../types';

class GameService {
  async createSession({ storyId, difficulty }: { storyId?: string; difficulty: string }): Promise<GameSession> {
    const story = await storyService.getStory(storyId, difficulty);
    const gameId = uuidv4();

    const session: GameSession = {
      gameId,
      storyId: story.id,
      title: story.title,
      surface: story.surface,
      truth: story.truth,             // 仅服务端持有，绝不下发
      difficulty: story.difficulty,
      evidenceThreshold: story.evidenceThreshold,
      phase: 'playing',
      questionCount: 0,
      evidence: [],
      sanity: 20,
      dialogue: [],                   // 滑动窗口对话（最近 8 轮）
      consecutiveIrrelevant: 0,
      createdAt: Date.now(),
    };

    // 写入 Redis，TTL = 24h
    await redisService.set(`game:${gameId}`, session, config.GAME_SESSION_TTL);
    return session;
  }

  async getSession(gameId: string): Promise<GameSession | null> {
    return redisService.get<GameSession>(`game:${gameId}`);
  }

  async processJudgeResult(gameId: string, question: string, result: JudgeResult): Promise<GameSession> {
    const session = await this.getSession(gameId);
    if (!session) throw new Error('Session not found');

    // 更新对话窗口（保留最近 N 轮）
    session.dialogue.push({ role: 'user', content: question });
    session.dialogue.push({ role: 'assistant', content: result.rawAnswer });
    if (session.dialogue.length > config.DIALOGUE_WINDOW_SIZE * 2) {
      session.dialogue = session.dialogue.slice(-config.DIALOGUE_WINDOW_SIZE * 2);
    }

    session.questionCount++;

    // 更新 evidence
    if (result.answer === 'yes' && result.isNewEvidence) {
      session.evidence.push({ question, confirmedAt: session.questionCount });
    }

    // 更新 sanity
    if (result.answer === 'irrelevant') {
      session.sanity = Math.max(0, session.sanity - 1);
      session.consecutiveIrrelevant++;
      if (session.consecutiveIrrelevant >= 3) {
        session.sanity = Math.max(0, session.sanity - 1); // 连续惩罚
        session.consecutiveIrrelevant = 0;
      }
    } else {
      session.consecutiveIrrelevant = 0;
    }

    // 检测游戏结束
    if (session.sanity === 0) session.phase = 'revealed';
    if (result.answer === 'solved') session.phase = 'solved';

    await redisService.set(`game:${gameId}`, session, config.GAME_SESSION_TTL);
    return session;
  }

  async endSession(gameId: string, phase: 'solved' | 'revealed'): Promise<void> {
    const session = await this.getSession(gameId);
    if (session) {
      session.phase = phase;
      await redisService.set(`game:${gameId}`, session, config.GAME_SESSION_TTL);
    }
  }
}

export const gameService = new GameService();
```

### 3.5 限流中间件

```typescript
// packages/server/src/middleware/rateLimit.ts
import { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/redis.service';
import { config } from '../config';
import { AppError } from './errorHandler';

export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const key = `ratelimit:${ip}`;

  const count = await redisService.incr(key);
  if (count === 1) {
    // 第一次计数，设置 60 秒窗口
    await redisService.expire(key, 60);
  }

  if (count > config.MAX_QUESTIONS_PER_MINUTE) {
    throw new AppError('RATE_LIMITED', `Too many requests. Max ${config.MAX_QUESTIONS_PER_MINUTE}/min`);
  }

  next();
}
```

### 3.6 统一错误处理

```typescript
// packages/server/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
  }
}

// 错误码 → HTTP 状态码映射
const ERROR_STATUS: Record<string, number> = {
  INVALID_GAME_ID: 404,
  GAME_OVER: 409,
  RATE_LIMITED: 429,
  AI_UNAVAILABLE: 503,
  INVALID_QUESTION: 400,
};

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(ERROR_STATUS[err.code] || 400).json({
      ok: false,
      error: { code: err.code, message: err.message }
    });
  }

  console.error('[unhandled error]', err);
  res.status(500).json({
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
  });
}
```

---

## 4. 前端设计

### 4.1 状态机（GameReducer）

```typescript
// packages/client/src/context/GameReducer.ts
import { GameState, GameAction } from '../types';
import { calcMistLevel } from '../lib/mistCalc';

export const initialState: GameState = {
  gameId: null,
  storyId: null,
  phase: 'idle',
  surface: null,
  title: null,
  difficulty: null,
  evidenceThreshold: 8,
  messages: [],
  evidence: [],
  sanity: 20,
  mistLevel: 0,
  questionCount: 0,
  isLoading: false,
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'GAME_STARTED':
      return {
        ...initialState,
        ...action.payload,
        phase: 'playing',
      };

    case 'QUESTION_SENT':
      return {
        ...state,
        isLoading: true,
        messages: [...state.messages, {
          id: action.payload.id,
          role: 'user',
          content: action.payload.question,
          timestamp: Date.now(),
        }],
      };

    case 'ANSWER_RECEIVED':
      const { answer, isNewEvidence, sanityDelta } = action.payload;
      const newEvidence = isNewEvidence
        ? [...state.evidence, { question: action.payload.question, confirmedAt: state.questionCount + 1 }]
        : state.evidence;
      const newSanity = Math.max(0, state.sanity + sanityDelta);
      const newMistLevel = calcMistLevel(newEvidence.length, state.evidenceThreshold);

      return {
        ...state,
        isLoading: false,
        questionCount: state.questionCount + 1,
        evidence: newEvidence,
        sanity: newSanity,
        mistLevel: newMistLevel,
        phase: answer === 'solved' ? 'solved' : newSanity === 0 ? 'revealed' : 'playing',
        messages: [...state.messages, {
          id: action.payload.messageId,
          role: 'assistant',
          content: action.payload.displayText,
          answer,
          timestamp: Date.now(),
        }],
      };

    case 'GAME_RESTORED':
      return { ...state, ...action.payload };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    default:
      return state;
  }
}
```

### 4.2 核心 Hook：useGame

```typescript
// packages/client/src/hooks/useGame.ts
import { useContext, useCallback } from 'react';
import { GameContext } from '../context/GameContext';
import { api } from '../lib/api';
import { v4 as uuidv4 } from 'uuid';

export function useGame() {
  const { state, dispatch } = useContext(GameContext);

  // 开始新游戏
  const startGame = useCallback(async (storyId?: string, difficulty = 'normal') => {
    const data = await api.post('/game/init', { storyId, difficulty });
    dispatch({ type: 'GAME_STARTED', payload: data });
  }, [dispatch]);

  // 提交提问（SSE 流式接收）
  const askQuestion = useCallback(async (question: string) => {
    if (!state.gameId || state.isLoading) return;

    const questionId = uuidv4();
    const answerMessageId = uuidv4();

    dispatch({ type: 'QUESTION_SENT', payload: { id: questionId, question } });

    // 启动 SSE 流
    const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/game/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: state.gameId, question }),
    });

    if (!response.ok || !response.body) {
      const err = await response.json();
      dispatch({ type: 'SET_LOADING', payload: false });
      throw new Error(err?.error?.message || 'Request failed');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') break;

        const event = JSON.parse(raw);
        if (event.type === 'chunk') {
          streamedText += event.content;
          // 实时更新最后一条消息（流式打字效果）
          dispatch({ type: 'UPDATE_STREAMING', payload: { id: answerMessageId, text: streamedText } });
        } else if (event.type === 'result') {
          dispatch({
            type: 'ANSWER_RECEIVED',
            payload: {
              messageId: answerMessageId,
              question,
              displayText: streamedText,
              answer: event.answer,
              isNewEvidence: event.isNewEvidence,
              sanityDelta: event.sanityDelta,
            }
          });
        }
      }
    }
  }, [state.gameId, state.isLoading, dispatch]);

  return { state, startGame, askQuestion };
}
```

### 4.3 MistLevel 计算

```typescript
// packages/client/src/lib/mistCalc.ts

/**
 * mistLevel = min(100, (evidence数 / 阈值) × 100)
 * 前端纯规则计算，不依赖 AI，保证一致性
 */
export function calcMistLevel(evidenceCount: number, threshold: number): number {
  if (threshold <= 0) return 0;
  return Math.min(100, Math.round((evidenceCount / threshold) * 100));
}

/**
 * mistLevel → CSS blur 值
 * mistLevel=0 时: blur=12px（全迷雾）
 * mistLevel=100 时: blur=0px（全清晰）
 */
export function calcBlur(mistLevel: number): number {
  return ((100 - mistLevel) / 100) * 12;
}
```

### 4.4 迷雾覆盖层组件

```tsx
// packages/client/src/components/Game/FogOverlay.tsx
import { useMemo } from 'react';
import { calcBlur } from '../../lib/mistCalc';

interface Props { mistLevel: number; }

export function FogOverlay({ mistLevel }: Props) {
  const blur = useMemo(() => calcBlur(mistLevel), [mistLevel]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-10 transition-all duration-1000"
      style={{
        backdropFilter: `blur(${blur}px)`,
        background: `rgba(10, 10, 20, ${(100 - mistLevel) / 100 * 0.35})`,
      }}
      aria-hidden="true"
    />
  );
}
```

### 4.5 LocalStorage 持久化 Hook

```typescript
// packages/client/src/hooks/usePersist.ts
import { useEffect } from 'react';
import { GameState } from '../types';
import { api } from '../lib/api';

const PERSIST_KEY = 'fog_of_truth_session';

interface PersistedData {
  gameId: string;
  messages: GameState['messages'];
  evidence: GameState['evidence'];
  sanity: number;
  mistLevel: number;
}

export function usePersist(
  state: GameState,
  onRestore: (data: Partial<GameState>) => void
) {
  // 持久化（状态变化时写入）
  useEffect(() => {
    if (!state.gameId) return;
    const data: PersistedData = {
      gameId: state.gameId,
      messages: state.messages,
      evidence: state.evidence,
      sanity: state.sanity,
      mistLevel: state.mistLevel,
    };
    localStorage.setItem(PERSIST_KEY, JSON.stringify(data));
  }, [state.gameId, state.messages, state.evidence, state.sanity, state.mistLevel]);

  // 恢复（组件挂载时尝试）
  useEffect(() => {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return;

    try {
      const persisted: PersistedData = JSON.parse(raw);
      api.get(`/game/state?gameId=${persisted.gameId}`)
        .then(serverState => {
          onRestore({ ...persisted, ...serverState });
        })
        .catch(() => {
          // 会话已过期，清除本地缓存
          localStorage.removeItem(PERSIST_KEY);
        });
    } catch {
      localStorage.removeItem(PERSIST_KEY);
    }
  }, []);
}
```

---

## 5. 数据结构与类型定义

```typescript
// packages/shared/src/types.ts

// ============ 服务端内部（绝不下发客户端）============

export interface GameSession {
  gameId: string;
  storyId: string;
  title: string;
  surface: string;
  truth: string;                      // ⚠️ 仅服务端，绝不出现在响应体
  difficulty: 'easy' | 'normal' | 'hard';
  evidenceThreshold: number;
  phase: 'playing' | 'solved' | 'revealed';
  questionCount: number;
  evidence: Evidence[];
  sanity: number;                     // 20 → 0
  dialogue: DialogueTurn[];           // 滑动窗口（最近 8 轮）
  consecutiveIrrelevant: number;
  createdAt: number;
}

// ============ 题库 ============

export interface Story {
  id: string;                         // 'builtin-001' | 'generated-{uuid}'
  title: string;
  surface: string;                    // 汤面（对外可见）
  truth: string;                      // 汤底（仅服务端）
  difficulty: 'easy' | 'normal' | 'hard';
  evidenceThreshold: number;          // easy=5, normal=8, hard=12
  tags: string[];                     // ['悬疑', '日常', '历史']
  source: 'builtin' | 'generated';
  createdAt: number;
}

// ============ 线索 ============

export interface Evidence {
  question: string;
  confirmedAt: number;
}

// ============ 对话 ============

export interface DialogueTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  answer?: 'yes' | 'no' | 'irrelevant' | 'solved';
  timestamp: number;
}

// ============ AI 裁判结果 ============

export interface JudgeResult {
  answer: 'yes' | 'no' | 'irrelevant' | 'solved';
  rawAnswer: string;                  // 去除 <think> 后的原始文本
  isNewEvidence: boolean;
  sanityDelta: number;                // 0 或 -1
}

// ============ 前端游戏状态 ============

export interface GameState {
  gameId: string | null;
  storyId: string | null;
  phase: 'idle' | 'playing' | 'solved' | 'revealed';
  surface: string | null;
  title: string | null;
  difficulty: 'easy' | 'normal' | 'hard' | null;
  evidenceThreshold: number;
  messages: Message[];
  evidence: Evidence[];
  sanity: number;
  mistLevel: number;                  // 0-100，前端计算
  questionCount: number;
  isLoading: boolean;
}

// ============ 错误码 ============

export type ErrorCode =
  | 'INVALID_GAME_ID'
  | 'GAME_OVER'
  | 'RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'INVALID_QUESTION';
```

---

## 6. API 接口规范

### 6.1 接口清单

| 方法 | 路径 | 功能 | 关键参数 |
|------|------|------|---------|
| POST | `/api/game/init` | 开始新游戏，返回汤面元数据 | `{ storyId?, difficulty }` |
| POST | `/api/game/ask` | 提交提问，SSE 流式返回裁判结果 | `{ gameId, question }` |
| POST | `/api/game/solve` | 提交最终推断，AI 综合评分 | `{ gameId, guess }` |
| GET | `/api/game/state` | 刷新后恢复会话状态 | `?gameId=` |
| GET | `/api/stories` | 获取题库列表（仅元数据） | `?difficulty=&page=` |

### 6.2 统一响应格式

```typescript
// 成功
{ ok: true, data: { ... } }

// 失败
{ ok: false, error: { code: ErrorCode, message: string } }
```

### 6.3 各接口响应示例

```typescript
// POST /api/game/init → Response
{
  ok: true,
  data: {
    gameId: "550e8400-e29b-41d4-a716-446655440000",
    storyId: "builtin-003",
    title: "最后的晚餐",
    surface: "一个男人吃完晚餐后死了。",
    difficulty: "normal",
    evidenceThreshold: 8
    // ⚠️ 无 truth 字段
  }
}

// POST /api/game/ask → SSE Stream
// event 1（流式）
data: {"type":"chunk","content":"是"}
// event 2（最终结果）
data: {"type":"result","answer":"yes","isNewEvidence":true,"sanityDelta":0}
// event 3（结束）
data: [DONE]

// POST /api/game/solve → Response
{
  ok: true,
  data: {
    solved: true,
    score: 87,
    feedback: "你的推理非常准确！核心要素都已找到。",
    truth: "男人对某种食物过敏，当晚误食后休克离世。"
    // ✅ solve 阶段可返回 truth（游戏已结束）
  }
}
```

### 6.4 错误码规范

| 错误码 | HTTP 状态 | 触发场景 |
|--------|----------|---------|
| `INVALID_GAME_ID` | 404 | gameId 不存在或已过期（24h） |
| `GAME_OVER` | 409 | sanity=0 或游戏已结束后继续提问 |
| `RATE_LIMITED` | 429 | 单 IP 每分钟超过 30 次提问 |
| `AI_UNAVAILABLE` | 503 | 主备模型均不可用 |
| `INVALID_QUESTION` | 400 | 提问为空、超过 200 字或格式非法 |

---

## 7. AI 引擎与 Prompt 工程

### 7.1 裁判判定 Prompt

```typescript
// packages/server/src/prompts/judge.prompt.ts

export function buildJudgeSystemPrompt(session: GameSession): string {
  const evidenceList = session.evidence.length > 0
    ? session.evidence.map(e => `- ${e.question}`).join('\n')
    : '（暂无已确认线索）';

  return `你是一个严肃的海龟汤游戏主持人，守护以下绝密真相，绝对不主动透露任何线索。

【汤底真相】（玩家不可见，请严格保密）
${session.truth}

【已确认线索】（玩家之前已获得"是"的回答，请保持一致性）
${evidenceList}

【裁判规则】
1. 分析玩家的问题后，你只能回答以下之一：
   - 「是」：问题描述符合真相
   - 「否」：问题描述不符合真相
   - 「无关」：问题与真相无关或无法判断
   - 「[SOLVED]」：玩家的陈述已接近或揭示了完整真相核心

2. 你的回答必须与已确认线索保持逻辑一致，不得前后矛盾。

3. 除上述四种回答外，不得输出任何额外文字或解释。

【内部推理（用户不可见）】
在给出最终回答前，先用 <think> 标签进行内部推理（此内容会被服务端过滤）：
<think>
1. 玩家的问题是什么？
2. 根据汤底真相，正确答案是什么？
3. 与已确认线索是否有逻辑冲突？
4. 最终应回答哪个选项？
</think>

然后只输出：是 / 否 / 无关 / [SOLVED]`;
}
```

### 7.2 裁判 AI 服务

```typescript
// packages/server/src/services/ai/judge.ts
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config';
import { buildJudgeSystemPrompt } from '../../prompts/judge.prompt';
import { sanitizeInput } from '../../lib/sanitize';
import { withFallback } from './fallback';
import type { GameSession, JudgeResult } from '../../types';

class JudgeAI {
  async judge({
    session,
    question,
    onChunk,
  }: {
    session: GameSession;
    question: string;
    onChunk: (chunk: string) => void;
  }): Promise<JudgeResult> {
    const safeQuestion = sanitizeInput(question);
    const systemPrompt = buildJudgeSystemPrompt(session);

    // 组装带滑动窗口的对话历史
    const messages = [
      ...session.dialogue,
      { role: 'user' as const, content: safeQuestion },
    ];

    return withFallback(async (apiKey: string, model: string) => {
      const client = new Anthropic({ apiKey });
      let fullText = '';

      const stream = client.messages.stream({
        model,
        max_tokens: 200,
        temperature: 0.1,             // 低温保证判定一致性
        system: systemPrompt,
        messages,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullText += chunk.delta.text;
          onChunk(chunk.delta.text);
        }
      }

      return this.parseResult(fullText, question);
    });
  }

  private parseResult(rawText: string, question: string): JudgeResult {
    // 过滤 <think>...</think> 内部推理
    const cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    let answer: JudgeResult['answer'] = 'irrelevant';
    if (cleaned.includes('[SOLVED]') || cleaned.includes('solved')) answer = 'solved';
    else if (cleaned === '是' || cleaned.toLowerCase() === 'yes') answer = 'yes';
    else if (cleaned === '否' || cleaned.toLowerCase() === 'no') answer = 'no';
    else if (cleaned === '无关' || cleaned.toLowerCase() === 'irrelevant') answer = 'irrelevant';

    return {
      answer,
      rawAnswer: cleaned,
      isNewEvidence: answer === 'yes',
      sanityDelta: answer === 'irrelevant' ? -1 : 0,
    };
  }
}

export const judgeAI = new JudgeAI();
```

### 7.3 AI 降级策略

```typescript
// packages/server/src/services/ai/fallback.ts
import { config } from '../../config';
import { AppError } from '../../middleware/errorHandler';

const MODELS = [
  { apiKey: config.DEEPSEEK_API_KEY, model: 'deepseek-chat', name: 'DeepSeek' },
  { apiKey: config.ANTHROPIC_API_KEY, model: 'claude-haiku-4-5', name: 'Claude Haiku' },
];

export async function withFallback<T>(
  fn: (apiKey: string, model: string) => Promise<T>
): Promise<T> {
  let lastError: Error | null = null;

  for (const { apiKey, model, name } of MODELS) {
    try {
      // 超时包装
      const result = await Promise.race([
        fn(apiKey, model),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI_TIMEOUT')), config.AI_TIMEOUT_MS)
        ),
      ]);
      return result;
    } catch (err) {
      console.warn(`[fallback] ${name} failed, trying next...`, err);
      lastError = err as Error;
    }
  }

  throw new AppError('AI_UNAVAILABLE', 'All AI models are currently unavailable', 503);
}
```

---

## 8. 上下文管理策略

### 8.1 结构化 Prompt 组装原则

```
每次请求的 System Prompt 结构（固定 + 动态）:
┌─────────────────────────────────────────────┐
│ [身份定义]          固定文本，每次注入       │
│ [汤底真相]          每次完整注入，不裁剪     │
│ [已确认线索]        从 evidence[] 提取       │  ← 关键：防止 AI 遗忘线索
│ [裁判规则]          固定文本                 │
│ [CoT 推理格式]      <think> 隔离指令         │
└─────────────────────────────────────────────┘
Messages 部分（动态，可裁剪）:
┌─────────────────────────────────────────────┐
│ dialogue[-8轮]      滑动窗口，超出丢弃       │  ← 优先丢弃，evidence 已兜底
│ user: {question}   本轮提问                  │
└─────────────────────────────────────────────┘
```

### 8.2 Token 预算估算

| 部分 | 估算 Token | 说明 |
|------|-----------|------|
| 身份定义 + 规则 | ~200 tokens | 固定不变 |
| 汤底真相 | ~100 tokens | 按题目复杂度浮动 |
| 已确认线索（最多12条） | ~150 tokens | 每条约12 tokens |
| 对话历史（8轮） | ~600 tokens | 每轮约75 tokens |
| 本轮提问 | ~50 tokens | 用户输入上限200字 |
| **合计** | **~1100 tokens** | 远低于模型上下文限制 |

### 8.3 核心原则

> **宁可丢弃对话轮次，也绝不丢弃 evidence 列表。**
> 已确认线索丢失会导致 AI 对同一问题给出矛盾回答，严重破坏游戏体验。

---

## 9. 游戏机制实现

### 9.1 Sanity（理智值）完整规则

| 事件 | 变化 | 说明 |
|------|------|------|
| 游戏开始 | = 20 | 初始值 |
| 回答「无关」 | −1 | 每次触发 |
| 连续 3 次「无关」 | 额外 −1 | 连续计数归零 |
| 回答「是」或「否」 | ±0 | 有正向动画反馈代替 |
| sanity ≤ 5 | 触发警告 UI | 呼吸灯 + 震动提示 |
| sanity = 0 | 游戏结束 | 强制揭示汤底 |

### 9.2 mistLevel 计算

```
mistLevel = min(100, floor(evidence数 / 阈值 × 100))

阈值（evidenceThreshold）：
  easy   = 5
  normal = 8
  hard   = 12

CSS 效果映射：
  blur = (100 - mistLevel) / 100 × 12   [px]
  迷雾透明度 = (100 - mistLevel) / 100 × 0.35
```

### 9.3 游戏阶段状态机

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
       开始游戏      ▼                    sanity=0             │
idle ──────────► playing ────────────────────────────► revealed
                    │                                    （揭示汤底）
                    │  answer='solved'
                    ▼
                  solved
               （恭喜通关）
```

---

## 10. 题库系统

### 10.1 内置题库示例（builtin-stories.json）

```json
[
  {
    "id": "builtin-001",
    "title": "最后的信号",
    "surface": "一名宇航员独自飘荡在太空中，看着窗外的地球，微笑着关掉了求救信号。",
    "truth": "宇航员得知地球刚刚发生了足以灭绝人类的核战争，他的家人已不复存在。关掉求救信号，是因为他不想再回到那个世界，选择在宁静的太空中度过最后的时光。",
    "difficulty": "normal",
    "evidenceThreshold": 8,
    "tags": ["科幻", "悬疑", "情感"],
    "source": "builtin",
    "createdAt": 1711123200000
  },
  {
    "id": "builtin-002",
    "title": "雨中的男人",
    "surface": "一个男人在大雨中站着，旁边有伞，却始终没有打开。",
    "truth": "这个男人是盲人，他不知道正在下雨，也不知道旁边有伞——那把伞是别人遗忘的。",
    "difficulty": "easy",
    "evidenceThreshold": 5,
    "tags": ["日常", "反转"],
    "source": "builtin",
    "createdAt": 1711123200000
  }
]
```

### 10.2 题库服务

```typescript
// packages/server/src/services/story.service.ts
import { redisService } from './redis.service';
import builtinStories from '../../data/builtin-stories.json';
import { generatorAI } from './ai/generator';
import type { Story } from '../types';

class StoryService {
  // 初始化：将内置题库写入 Redis（若不存在）
  async seed(): Promise<void> {
    for (const story of builtinStories) {
      const key = `story:${story.id}`;
      const exists = await redisService.exists(key);
      if (!exists) {
        await redisService.set(key, story); // 无 TTL，永久保留
      }
    }
  }

  async getStory(storyId?: string, difficulty = 'normal'): Promise<Story> {
    if (storyId) {
      const story = await redisService.get<Story>(`story:${storyId}`);
      if (story) return story;
    }

    // 随机从指定难度的内置题库中返回
    const pool = builtinStories.filter(s => s.difficulty === difficulty);
    return pool[Math.floor(Math.random() * pool.length)] as Story;
  }

  async generateStory(difficulty: string): Promise<Story> {
    // 检查缓存（相同参数 24h 内复用）
    const cacheKey = `story:generated:${difficulty}:${Date.now() - (Date.now() % 86400000)}`;
    const cached = await redisService.get<Story>(cacheKey);
    if (cached) return cached;

    const story = await generatorAI.generate({ difficulty });
    await redisService.set(cacheKey, story, 24 * 60 * 60);
    return story;
  }

  async listStories(difficulty?: string, page = 1, pageSize = 10): Promise<Omit<Story, 'truth'>[]> {
    // 返回元数据，不包含 truth
    return builtinStories
      .filter(s => !difficulty || s.difficulty === difficulty)
      .slice((page - 1) * pageSize, page * pageSize)
      .map(({ truth, ...meta }) => meta as Omit<Story, 'truth'>);
  }
}

export const storyService = new StoryService();
```

---

## 11. 安全设计

### 11.1 安全要求（硬性约束）

| 风险 | 措施 | 执行层 |
|------|------|--------|
| **API Key 泄露** | Key 仅存于后端环境变量，绝不传至客户端 | Express 服务端 |
| **汤底泄露** | `truth` 字段从不出现在任何 HTTP 响应体（除 solve 结束后） | 服务端过滤 |
| **请求滥用** | IP 限流：每分钟 30 次 ask，Redis 原子计数器 | 中间件 |
| **Prompt 注入** | 用户输入截断至 200 字，HTML/特殊字符转义后再拼接 | sanitize.ts |
| **会话伪造** | gameId 为服务端签发的 UUID v4，校验后才读取对应 truth | Redis |
| **CORS 攻击** | 仅允许配置的前端域名，OPTIONS 预检严格处理 | Express CORS |

### 11.2 输入清洗

```typescript
// packages/server/src/lib/sanitize.ts

export function sanitizeInput(input: string): string {
  return input
    .slice(0, 200)                              // 长度截断
    .replace(/[<>'"\\`]/g, '')                  // 过滤 HTML/注入字符
    .replace(/\[INST\]|\[\/INST\]|<\|.*?\|>/g, '') // 过滤 LLM 特殊 token
    .trim();
}
```

---

## 12. 性能优化

### 12.1 SSE 流式输出

- **ask 接口**启用 SSE，首字响应目标 < 500ms
- 前端收到第一个 `chunk` 事件后立即渲染，无需等待完整响应
- `[DONE]` 事件触发最终状态更新

### 12.2 前端乐观更新

```typescript
// 用户提交问题后，立即渲染用户气泡（不等 AI 响应）
dispatch({ type: 'QUESTION_SENT', payload: { id: questionId, question } });
// AI 回复到来前展示 loading 动画（isLoading = true）
```

### 12.3 题库预热

```typescript
// packages/server/src/app.ts
import { storyService } from './services/story.service';

// 服务启动时预热内置题库到 Redis
storyService.seed().then(() => {
  console.log('[seed] Built-in stories loaded');
});
```

### 12.4 AI 生成题目缓存

- 相同难度的生成请求，24 小时内复用缓存，避免重复 AI 调用费用
- 缓存 key 按日期对齐：`story:generated:{difficulty}:{date}`

---

## 13. 环境配置与部署

### 13.1 环境变量（.env 示例）

```bash
# packages/server/.env

# 服务端口
PORT=3001

# 前端域名（CORS 白名单）
CLIENT_ORIGIN=http://localhost:5173

# AI Keys（绝不泄露）
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Redis（Upstash 推荐用于生产）
REDIS_URL=redis://localhost:6379
# 生产: REDIS_URL=rediss://default:password@xxx.upstash.io:6380

# packages/client/.env
VITE_API_BASE=http://localhost:3001/api
```

### 13.2 本地开发启动

```bash
# 1. 启动 Redis（Docker）
docker run -d -p 6379:6379 redis:7-alpine

# 2. 启动后端
cd packages/server
npm install
npm run dev          # 监听 :3001

# 3. 启动前端
cd packages/client
npm install
npm run dev          # 监听 :5173
```

### 13.3 生产部署建议

```
后端:
  - Railway / Render / Fly.io（支持持久化 Node.js 服务）
  - 或 VPS + PM2 + Nginx 反代
  - 环境变量通过平台 Secret 管理

前端:
  - Vercel / Netlify（静态托管）
  - VITE_API_BASE 指向后端生产域名

Redis:
  - Upstash（Serverless Redis，按用量计费）
  - 或 Railway 附加 Redis 插件
```

### 13.4 Workspace 配置

```json
// package.json（根目录）
{
  "name": "fog-of-truth",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev:server": "npm run dev --workspace=packages/server",
    "dev:client": "npm run dev --workspace=packages/client",
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "build": "npm run build --workspaces"
  }
}
```

---

## 14. 开发路线图

| 阶段 | 时间 | 核心交付物 |
|------|------|-----------|
| **Phase 1** | Day 1 | Monorepo 初始化，共享类型定义，前端静态组件（MysteryCard / SanityBar / FogOverlay） |
| **Phase 2** | Day 2 | Express 后端骨架，Redis 集成，题库 seed，`/api/game/init` 联调 |
| **Phase 3** | Day 3 | DeepSeek 裁判接入，System Prompt 调试，`<think>` 隔离验证，`/api/game/ask` 基础版 |
| **Phase 4** | Day 4 | SSE 流式输出端到端联调，IP 限流，错误码处理，前端 useGame hook |
| **Phase 5** | Day 5 | sanity / evidence / mistLevel 机制联调，EvidencePanel / SolveModal，LocalStorage 持久化 |
| **Phase 6** | Day 6 | Claude Haiku 降级验证，移动端适配，音效集成 |
| **Phase 7** | Day 7 | E2E 测试，生产部署（Railway + Vercel），监控接入 |

---

## 15. 附录：Agent 指令集

以下为 AI Agent 开发时的标准化指令，可直接用于 Cursor / GitHub Copilot / 其他 AI 编程助手。

### 15.1 后端初始化指令

```
你是一个 Node.js / Express 后端开发专家。
请按照以下规范创建 packages/server 目录：

技术栈：Express.js + TypeScript + tsx（开发热重载）
目标功能：
1. 创建 src/app.ts，配置 CORS、helmet、json body parser
2. 创建 src/config.ts，读取所有环境变量并做类型断言
3. 创建 src/routes/game.ts，实现 /api/game 路由骨架（init / ask / solve / state）
4. 创建 src/middleware/errorHandler.ts，定义 AppError 类和统一错误中间件
5. 创建 src/services/redis.service.ts，封装 ioredis 的 get/set/incr/expire

安全要求：
- API Key 只从环境变量读取
- truth 字段永远不出现在响应 JSON 中
- 所有用户输入经过 sanitizeInput() 处理后再使用
```

### 15.2 AI 裁判 Prompt 调试指令

```
你是一个 Prompt Engineering 专家。
请帮我优化以下海龟汤裁判 System Prompt，目标是：

1. 判定结果严格限制为「是/否/无关/[SOLVED]」之一，不得有额外文字
2. 保持与 evidence 列表的逻辑一致性
3. 使用 <think>...</think> 标签隔离内部推理，最终只输出判定词
4. temperature=0.1 下结果一致性最大化

当前 Prompt：
[粘贴 buildJudgeSystemPrompt() 输出]

请用 5 个测试问题验证，并给出优化建议。
```

### 15.3 前端 GameReducer 指令

```
你是一个 React + TypeScript 开发专家。
请创建 packages/client/src/context/GameReducer.ts：

要求：
1. State 类型完全符合 packages/shared/src/types.ts 中的 GameState 定义
2. 处理以下 action：GAME_STARTED / QUESTION_SENT / ANSWER_RECEIVED / UPDATE_STREAMING / GAME_RESTORED / SET_LOADING
3. ANSWER_RECEIVED 中调用 calcMistLevel() 计算 mistLevel（不依赖后端）
4. ANSWER_RECEIVED 中更新 sanity，并自动将 phase 更新为 'revealed'（sanity=0）或 'solved'（answer='solved'）
5. 所有状态转换都是纯函数，无副作用
```

### 15.4 SSE 流式接收指令

```
你是一个前端开发专家，熟悉 Fetch API 和 Server-Sent Events。
请在 packages/client/src/hooks/useGame.ts 中实现 askQuestion 函数：

要求：
1. 使用 fetch() 发起 POST /api/game/ask，response.body 作为 ReadableStream 处理
2. 解析 "data: {...}\n\n" 格式的 SSE 事件
3. type='chunk' 时实时更新 UI（打字机效果）
4. type='result' 时触发 ANSWER_RECEIVED reducer action
5. 错误处理：网络断开 / HTTP 非 200 / JSON 解析失败 均需捕获并展示
6. 不依赖任何第三方 SSE 库，纯原生实现
```

---

*文档版本：v3.0 · 前后端分离优化版*  
*最后更新：2026-03-24*  
*维护：内部研发团队*
