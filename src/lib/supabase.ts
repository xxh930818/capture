import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 检查是否配置了 Supabase
const hasSupabase = !!(supabaseUrl && supabaseAnonKey);

// 创建 Supabase 客户端（仅在配置时）
export const supabase = hasSupabase
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// 数据库类型定义
export interface DetectionLog {
  id: string;
  created_at: string;
  detection_type: 'face' | 'pose' | 'object';
  confidence: number;
  metadata: Record<string, any>;
  image_url?: string;
  user_id?: string;
}

export interface Screenshot {
  id: string;
  created_at: string;
  image_url: string;
  storage_path: string;
  user_id?: string;
}

// 存储桶名称
export const STORAGE_BUCKETS = {
  SCREENSHOTS: 'screenshots',
  DETECTIONS: 'detections',
} as const;

// 辅助函数：上传截图
export async function uploadScreenshot(
  file: File | Blob,
  fileName: string
): Promise<string | null> {
  if (!supabase) {
    console.warn('Supabase 未配置，跳过上传');
    return null;
  }

  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.SCREENSHOTS)
      .upload(`${Date.now()}-${fileName}`, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKETS.SCREENSHOTS)
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error('上传截图失败:', error);
    return null;
  }
}

// 辅助函数：保存检测记录
export async function saveDetectionLog(log: Omit<DetectionLog, 'id' | 'created_at'>) {
  if (!supabase) {
    console.warn('Supabase 未配置，跳过保存');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('detection_logs')
      .insert(log)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('保存检测记录失败:', error);
    return null;
  }
}

// 辅助函数：获取检测历史
export async function getDetectionLogs(limit = 50) {
  if (!supabase) {
    console.warn('Supabase 未配置，返回空数组');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('detection_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('获取检测记录失败:', error);
    return [];
  }
}
