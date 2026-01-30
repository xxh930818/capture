"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [detections, setDetections] = useState<string[]>([]);
  const [modelLoaded, setModelLoaded] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

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
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsMonitoring(false);
    setDetections([]);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  // 截图
  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;

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

    // 下载图片
    const link = document.createElement("a");
    link.download = `capture-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  // 切换摄像头
  const switchCamera = async () => {
    stopCamera();
    // 简单的切换逻辑，实际可能需要更复杂的处理
    await startCamera();
  };

  useEffect(() => {
    // 组件卸载时清理
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* 头部 */}
      <header className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              AI Capture Monitor
            </h1>
            <p className="text-xs text-zinc-400 mt-1">实时 AI 摄像监控</p>
          </div>
          {modelLoaded && (
            <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded">
              AI 模型已加载
            </span>
          )}
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          {/* 视频容器 */}
          <div className="relative bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl">
            {!isMonitoring ? (
              <div className="aspect-video flex flex-col items-center justify-center text-center p-8">
                <div className="w-24 h-24 mb-6 rounded-full bg-zinc-800 flex items-center justify-center">
                  <svg className="w-12 h-12 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">准备就绪</h2>
                <p className="text-zinc-400 mb-6">点击下方按钮启动摄像头监控</p>
                <button
                  onClick={startCamera}
                  disabled={isLoading}
                  className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 text-white font-semibold rounded-xl transition-colors"
                >
                  {isLoading ? "启动中..." : "启动监控"}
                </button>
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
                  className="absolute inset-0 w-full h-full"
                />

                {/* 检测信息覆盖层 */}
                {detections.length > 0 && (
                  <div className="absolute top-4 left-4 right-4 space-y-2">
                    {detections.map((detection, i) => (
                      <div
                        key={i}
                        className="bg-black/70 backdrop-blur-sm text-green-400 text-sm px-3 py-2 rounded-lg font-mono"
                      >
                        {detection}
                      </div>
                    ))}
                  </div>
                )}

                {/* 状态指示器 */}
                <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm px-3 py-2 rounded-full">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-white text-sm font-medium">REC</span>
                  </div>
                  <div className="text-white text-xs font-mono bg-black/70 backdrop-blur-sm px-2 py-1 rounded">
                    {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 控制栏 */}
          {isMonitoring && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <button
                onClick={captureSnapshot}
                className="flex flex-col items-center gap-1 p-4 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs text-zinc-400">截图</span>
              </button>

              <button
                onClick={switchCamera}
                className="flex flex-col items-center gap-1 p-4 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-xs text-zinc-400">切换</span>
              </button>

              <button
                onClick={stopCamera}
                className="flex flex-col items-center gap-1 p-4 bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                <span className="text-xs text-white">停止</span>
              </button>
            </div>
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
              <div className="text-purple-400 font-semibold">截图保存</div>
              <div className="text-xs text-zinc-500 mt-1">本地存储</div>
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
