-- AI Capture Monitor 数据库架构

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 检测记录表
CREATE TABLE IF NOT EXISTS detection_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  detection_type TEXT NOT NULL CHECK (detection_type IN ('face', 'pose', 'object')),
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  metadata JSONB DEFAULT '{}',
  image_url TEXT,
  user_id UUID
);

-- 截图记录表
CREATE TABLE IF NOT EXISTS screenshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  user_id UUID
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_detection_logs_created_at ON detection_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_detection_logs_type ON detection_logs(detection_type);
CREATE INDEX IF NOT EXISTS idx_screenshots_created_at ON screenshots(created_at DESC);

-- 启用 Row Level Security
ALTER TABLE detection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenshots ENABLE ROW LEVEL SECURITY;

-- 允许公开读取（根据需求调整）
CREATE POLICY "允许公开查看检测记录" ON detection_logs
  FOR SELECT USING (true);

CREATE POLICY "允许公开查看截图" ON screenshots
  FOR SELECT USING (true);

-- 允许认证用户插入
CREATE POLICY "允许认证用户插入检测记录" ON detection_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "允许认证用户插入截图" ON screenshots
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 创建存储桶
-- 注意：需要在 Supabase Dashboard > Storage 中手动创建以下存储桶：
-- 1. screenshots (public)
-- 2. detections (public)

-- 或者使用 SQL（需要 service_role key）
-- INSERT INTO storage.buckets (id, name, public) VALUES ('screenshots', 'screenshots', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('detections', 'detections', true);
