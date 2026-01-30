"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DetectionList, DetectionResult } from "@/components/detection-result";
import { MonitoringStats } from "@/components/monitoring-stats";
import { uploadScreenshot } from "@/lib/supabase";

interface Detection {
  type: 'face' | 'pose' | 'object';
  confidence: number;
  label: string;
  timestamp: Date;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [duration, setDuration] = useState(0);
  const [screenshotCount, setScreenshotCount] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef<NodeJS.Timeout | null>(null);
  const isUploadingRef = useRef(false);

  // 启动摄像头
  const startCamera = async () => {
    try {
      setIsLoading(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsMonitoring(true);
      setIsLoading(false);

      // 开始计时
      durationRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("摄像头访问失败:", error);
      alert("无法访问摄像头，请确保已授予权限");
      setIsLoading(false);
    }
  };

  // 停止摄像头
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }
    setIsMonitoring(false);
    setDetections([]);
    setDuration(0);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  // 截图并上传到 Supabase
  const captureSnapshot = async () => {
    if (!videoRef.current || !canvasRef.current || isUploadingRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    // 添加时间戳
    ctx.fillStyle = "#00ff88";
    ctx.font = "20px monospace";
    ctx.fillText(new Date().toLocaleString(), 10, 30);

    // 转换为 Blob
    canvas.toBlob(async (blob) => {
      if (!blob) return;

      // 下载到本地
      const link = document.createElement("a");
      link.download = `capture-${Date.now()}.png`;
      link.href = URL.createObjectURL(blob);
      link.click();

      // 上传到 Supabase（如果配置了）
      isUploadingRef.current = true;
      const fileName = `capture-${Date.now()}.png`;
      const publicUrl = await uploadScreenshot(blob, fileName);

      if (publicUrl) {
        console.log("截图已上传到 Supabase:", publicUrl);
        setScreenshotCount(prev => prev + 1);
      }

      isUploadingRef.current = false;
    }, 'image/png');
  };

  // 模拟检测（用于演示）
  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(() => {
      // 模拟随机检测结果
      const types: Array<'face' | 'pose' | 'object'> = ['face', 'pose', 'object'];
      const labels = {
        face: ['检测到人脸', '多个人脸', '人脸识别成功'],
        pose: ['站立姿态', '坐着', '挥手'],
        object: ['检测到移动物体', '未知物体'],
      };

      const randomType = types[Math.floor(Math.random() * types.length)];
      const randomLabel = labels[randomType][Math.floor(Math.random() * 3)];
      const randomConfidence = 0.7 + Math.random() * 0.29;

      const newDetection: Detection = {
        type: randomType,
        confidence: randomConfidence,
        label: randomLabel,
        timestamp: new Date(),
      };

      setDetections(prev => [newDetection, ...prev].slice(0, 10));
    }, 3000);

    return () => clearInterval(interval);
  }, [isMonitoring]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const alertCount = detections.filter(d => d.confidence > 0.9).length;

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* 头部 */}
      <header className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isMonitoring ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`}></div>
              AI Capture Monitor
            </h1>
            <p className="text-xs text-zinc-400 mt-1">实时 AI 摄像监控</p>
          </div>
          {isMonitoring && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">{new Date().toLocaleTimeString()}</span>
              <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full">REC</span>
            </div>
          )}
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
        <div className="w-full max-w-4xl space-y-4">
          {/* 视频容器 */}
          <Card className="bg-zinc-900 border-0 overflow-hidden">
            {!isMonitoring ? (
              <div className="aspect-video flex flex-col items-center justify-center text-center p-8">
                <div className="w-24 h-24 mb-6 rounded-full bg-zinc-800 flex items-center justify-center">
                  <svg className="w-12 h-12 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">准备就绪</h2>
                <p className="text-zinc-400 mb-6">点击下方按钮启动摄像头监控</p>
                <Button onClick={startCamera} isLoading={isLoading} size="lg">
                  启动监控
                </Button>
              </div>
            ) : (
              <div className="relative aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />

                {/* 检测信息覆盖层 */}
                {detections.length > 0 && (
                  <div className="absolute top-4 left-4 space-y-2 max-w-xs">
                    {detections.slice(0, 3).map((detection, i) => (
                      <DetectionResult key={`${i}-${detection.timestamp.getTime()}`} {...detection} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* 统计信息 */}
          {isMonitoring && (
            <MonitoringStats
              duration={duration}
              detections={detections.length}
              screenshots={screenshotCount}
              alerts={alertCount}
            />
          )}

          {/* 控制栏 */}
          {isMonitoring && (
            <div className="flex items-center justify-center gap-4">
              <Button variant="secondary" onClick={captureSnapshot} disabled={isUploadingRef.current}>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {isUploadingRef.current ? '上传中...' : '截图'}
              </Button>

              <Button variant="secondary" onClick={stopCamera}>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                停止
              </Button>
            </div>
          )}

          {/* 检测历史 */}
          {isMonitoring && detections.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-zinc-400 mb-3">检测历史</h3>
                <DetectionList detections={detections} maxItems={5} />
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* 功能说明 */}
      <footer className="bg-zinc-900 border-t border-zinc-800 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-zinc-800/50 rounded-xl">
              <div className="text-green-400 font-semibold">人脸检测</div>
              <div className="text-xs text-zinc-500 mt-1">实时识别</div>
            </div>
            <div className="p-3 bg-zinc-800/50 rounded-xl">
              <div className="text-blue-400 font-semibold">姿态识别</div>
              <div className="text-xs text-zinc-500 mt-1">动作捕捉</div>
            </div>
            <div className="p-3 bg-zinc-800/50 rounded-xl">
              <div className="text-purple-400 font-semibold">云端存储</div>
              <div className="text-xs text-zinc-500 mt-1">Supabase</div>
            </div>
            <div className="p-3 bg-zinc-800/50 rounded-xl">
              <div className="text-orange-400 font-semibold">PWA</div>
              <div className="text-xs text-zinc-500 mt-1">离线可用</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
