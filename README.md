# AI Capture Monitor

AI 摄像监控 PWA - 实时人脸检测、姿态识别、云端存储

## 功能特性

- **实时监控**: 摄像头实时视频流
- **人脸检测**: AI 人脸识别（模拟演示）
- **姿态识别**: 人体姿态检测（模拟演示）
- **截图保存**: 本地下载 + 云端存储
- **PWA 支持**: 可安装到主屏幕，离线可用
- **响应式设计**: 适配手机、平板、桌面

## 技术栈

- **前端**: Next.js 16 + TypeScript + Tailwind CSS
- **PWA**: @ducanh2912/next-pwa
- **数据库**: Supabase (PostgreSQL + Storage)
- **AI**: TensorFlow.js + face-api.js

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`：

```env
# Supabase (可选，用于云端存储)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 4. 构建生产版本

```bash
npm run build
npm start
```

## Supabase 配置（可选）

### 1. 创建项目

访问 https://supabase.com 创建新项目

### 2. 运行 SQL 迁移

在 Supabase Dashboard > SQL Editor 中运行：

```sql
-- 复制 supabase/migrations/001_initial_schema.sql 的内容
```

### 3. 创建存储桶

在 Supabase Dashboard > Storage 中创建：

- `screenshots` - Public bucket
- `detections` - Public bucket

### 4. 获取凭据

在 Project Settings > API 中获取：
- Project URL
- anon/public key

填入 `.env.local`

## 部署到 Vercel

### 方法 1: 通过 Vercel Dashboard

1. 访问 https://vercel.com/new
2. 导入 GitHub 仓库 `xxh930818/capture`
3. 添加环境变量
4. 部署！

### 方法 2: 通过 CLI

```bash
npm install -g vercel
vercel
```

### 环境变量

在 Vercel 项目设置中添加：

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## PWA 安装

### iOS (Safari)

1. 访问应用网址
2. 点击分享按钮
3. 选择"添加到主屏幕"
4. 点击"添加"

### Android (Chrome)

1. 访问应用网址
2. 点击浏览器菜单
3. 选择"安装应用"或"添加到主屏幕"

## 项目结构

```
capture/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React 组件
│   │   └── ui/          # UI 基础组件
│   └── lib/             # 工具函数
├── public/              # 静态资源
│   └── manifest.json    # PWA 配置
├── supabase/            # Supabase 迁移文件
└── package.json
```

## 许可证

MIT
