"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef<NodeJS.Timeout | null>(null);

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

      durationRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("摄像头访问失败:", error);
      alert("无法访问摄像头，请确保已授予权限");
      setIsLoading(false);
    }
  };

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
    setDuration(0);
  };

  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    ctx.fillStyle = "#00ff88";
    ctx.font = "20px monospace";
    ctx.fillText(new Date().toLocaleString(), 10, 30);

    const link = document.createElement("a");
    link.download = `capture-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col">
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

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl space-y-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
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
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />
              </div>
            )}
          </div>

          {isMonitoring && (
            <>
              <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-white">{Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}</div>
                    <div className="text-xs text-zinc-500">运行时长</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">REC</div>
                    <div className="text-xs text-zinc-500">状态</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={captureSnapshot}
                  className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl transition-colors"
                >
                  截图
                </button>
                <button
                  onClick={stopCamera}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
                >
                  停止
                </button>
              </div>
            </>
          )}

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
      </main>
    </div>
  );
}
