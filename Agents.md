# AI海龟汤游戏开发指令

## 项目概述
使用React + TypeScript + Tailwind CSS开发的AI海龟汤游戏网站。

## 开发规范
- 使用TypeScript，确保类型安全
- 使用函数式组件 + Hooks
- 使用Tailwind CSS编写样式
- 组件要可复用，代码要有注释

## 代码风格
- 组件名使用PascalCase
- 函数名使用camelCase
- 常量使用UPPER_SNAKE_CASE
- 类型定义以T开头（如TStory）

## 设计要求
- 整体风格：神秘悬疑，深蓝色调（bg-slate-900）
- 强调色：金色（text-amber-400）
- 圆角：rounded-lg
- 阴影：shadow-lg

## 注意事项
- 保持代码简洁，避免过度设计
- 优先实现核心功能
- 确保移动端适配
- AI API Key不要硬编码，使用环境变量（出于安全考虑不要在程序代码中暴露自己的API Key）

## 测试要求
- 每个功能完成后手动测试
- 确保各种屏幕尺寸正常显示
- 测试AI回答是否准确