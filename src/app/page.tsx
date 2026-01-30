"use client";

import { useEffect, useRef, useState } from "react";

interface Face {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DetectionLog {
  time: string;
  type: string;
  message: string;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [faceCount, setFaceCount] = useState(0);
  const [motionLevel, setMotionLevel] = useState(0);
  const [snapshots, setSnapshots] = useState<number>(0);
  const [detectionLogs, setDetectionLogs] = useState<DetectionLog[]>([]);
  const [lastDetection, setLastDetection] = useState<string>("--");
  const [debugMode, setDebugMode] = useState(false);
  const [skinPixels, setSkinPixels] = useState<number>(0);

  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const previousFrameRef = useRef<ImageData | null>(null);
  const lastLogTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);

  const addLog = (type: string, message: string) => {
    const now = Date.now();
    if (now - lastLogTimeRef.current < 500) return;
    lastLogTimeRef.current = now;

    const time = new Date().toLocaleTimeString();
    setDetectionLogs((prev) => {
      const newLogs = [{ time, type, message }, ...prev].slice(0, 15);
      return newLogs;
    });
  };

  // Enhanced skin detection with more ranges
  const isSkinPixel = (r: number, g: number, b: number): boolean => {
    // Very relaxed skin detection for better detection
    // Light skin
    if (r > 220 && g > 180 && b > 140 && r > g && r > b) return true;
    // Medium-light skin
    if (r > 180 && g > 130 && b > 90 && r > g * 1.1 && r - g > 20) return true;
    // Medium skin
    if (r > 140 && g > 90 && b > 70 && r > g * 1.15 && r - g > 25) return true;
    // Medium-dark skin
    if (r > 110 && g > 70 && b > 55 && r > g * 1.1 && r - g > 20) return true;
    // Dark skin
    if (r > 80 && g > 55 && b > 45 && r > g * 1.08 && r - g > 15) return true;

    return false;
  };

  // Enhanced face detection
  const detectFaces = (ctx: CanvasRenderingContext2D, width: number, height: number): Face[] => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const detectedPixels: { x: number; y: number }[] = [];

    // Higher sampling rate for better detection
    const step = 5;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (isSkinPixel(r, g, b)) {
          detectedPixels.push({ x, y });
        }
      }
    }

    setSkinPixels(detectedPixels.length);

    // Cluster pixels into faces
    const faces: Face[] = [];
    const visited = new Set<string>();

    detectedPixels.forEach((pixel) => {
      const key = `${pixel.x},${pixel.y}`;
      if (visited.has(key)) return;

      const cluster: { x: number; y: number }[] = [];
      const queue = [pixel];
      const clusterRadius = 120;

      while (queue.length > 0) {
        const p = queue.shift()!;
        const pKey = `${p.x},${p.y}`;
        if (visited.has(pKey)) continue;
        if (cluster.length >= 500) break;

        visited.add(pKey);
        cluster.push(p);

        detectedPixels.forEach((sp) => {
          const dist = Math.sqrt((p.x - sp.x) ** 2 + (p.y - sp.y) ** 2);
          if (dist < clusterRadius) {
            const spKey = `${sp.x},${sp.y}`;
            if (!visited.has(spKey)) {
              queue.push(sp);
            }
          }
        });
      }

      // Lower threshold for face detection
      if (cluster.length > 20) {
        const minX = Math.min(...cluster.map((p) => p.x));
        const maxX = Math.max(...cluster.map((p) => p.x));
        const minY = Math.min(...cluster.map((p) => p.y));
        const maxY = Math.max(...cluster.map((p) => p.y));

        const w = maxX - minX;
        const h = maxY - minY;

        // Relaxed aspect ratio check
        if (w > 25 && h > 35 && h / w > 0.6 && h / w < 4) {
          const overlaps = faces.some((f) =>
            minX < f.x + f.width + 50 &&
            maxX + w > f.x - 50 &&
            minY < f.y + f.height + 50 &&
            maxY + h > f.y - 50
          );

          if (!overlaps) {
            faces.push({
              x: Math.max(0, minX - 30),
              y: Math.max(0, minY - 40),
              width: w + 60,
              height: h + 80
            });
          }
        }
      }
    });

    return faces.slice(0, 5);
  };

  // Motion detection
  const detectMotion = (ctx: CanvasRenderingContext2D, width: number, height: number): number => {
    const scale = Math.min(1, 320 / width);
    const sw = Math.floor(width * scale);
    const sh = Math.floor(height * scale);

    const currentFrame = ctx.getImageData(0, 0, sw, sh);
    const prevFrame = previousFrameRef.current;

    if (!prevFrame) {
      previousFrameRef.current = currentFrame;
      return 0;
    }

    const current = currentFrame.data;
    const previous = prevFrame.data;
    let motionPixels = 0;

    for (let i = 0; i < current.length; i += 8) {
      const diff = Math.abs(current[i] - previous[i]) +
                   Math.abs(current[i + 1] - previous[i + 1]) +
                   Math.abs(current[i + 2] - previous[i + 2]);

      if (diff > 30) {
        motionPixels++;
      }
    }

    previousFrameRef.current = currentFrame;
    return Math.min(100, Math.round((motionPixels / (current.length / 8)) * 400));
  };

  // Draw debug info
  const drawDebug = (ctx: CanvasRenderingContext2D) => {
    if (!debugMode) return;

    ctx.fillStyle = "rgba(0, 255, 136, 0.1)";
    ctx.font = "12px monospace";
    ctx.fillText(`Skin pixels: ${skinPixels}`, 10, 70);
    ctx.fillText(`Faces: ${faceCount}`, 10, 85);
    ctx.fillText(`Motion: ${motionLevel}%`, 10, 100);
  };

  // Draw face boxes
  const drawFaces = (ctx: CanvasRenderingContext2D, faces: Face[]) => {
    const colors = ["#00ff88", "#00d4ff", "#ff6b6b", "#ffd93d", "#a855f7"];

    faces.forEach((face, index) => {
      const color = colors[index % colors.length];

      // Draw semi-transparent fill
      ctx.fillStyle = `${color}20`;
      ctx.fillRect(face.x, face.y, face.width, face.height);

      // Draw border
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;

      const bracketSize = 25;
      ctx.beginPath();
      // Top-left
      ctx.moveTo(face.x + bracketSize, face.y);
      ctx.lineTo(face.x, face.y);
      ctx.lineTo(face.x, face.y + bracketSize);
      // Top-right
      ctx.moveTo(face.x + face.width - bracketSize, face.y);
      ctx.lineTo(face.x + face.width, face.y);
      ctx.lineTo(face.x + face.width, face.y + bracketSize);
      // Bottom-left
      ctx.moveTo(face.x, face.y + face.height - bracketSize);
      ctx.lineTo(face.x, face.y + face.height);
      ctx.lineTo(face.x + bracketSize, face.y + face.height);
      // Bottom-right
      ctx.moveTo(face.x + face.width - bracketSize, face.y + face.height);
      ctx.lineTo(face.x + face.width, face.y + face.height);
      ctx.lineTo(face.x + face.width, face.y + face.height - bracketSize);
      ctx.stroke();

      // Label background
      ctx.fillStyle = color;
      ctx.fillRect(face.x, face.y - 26, 85, 22);

      // Label text
      ctx.fillStyle = "#000";
      ctx.font = "bold 13px monospace";
      ctx.fillText(`FACE ${index + 1}`, face.x + 6, face.y - 10);
    });

    setFaceCount(faces.length);
    if (faces.length > 0) {
      setLastDetection(new Date().toLocaleTimeString());
    }
  };

  // Draw motion indicators
  const drawMotion = (ctx: CanvasRenderingContext2D, motion: number) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // Motion bars
    for (let i = 0; i < 10; i++) {
      const isActive = motion >= (i + 1) * 10;
      ctx.fillStyle = isActive ? "#ff6b6b" : "#333";
      ctx.fillRect(width - 18, 15 + i * 10, 10, 6);
    }
  };

  // Detection loop
  const detectFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isMonitoring) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    canvasCtxRef.current = ctx;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Detect and draw faces
    const faces = detectFaces(ctx, canvas.width, canvas.height);
    drawFaces(ctx, faces);

    // Log periodically
    frameCountRef.current++;
    if (frameCountRef.current % 30 === 0) {
      if (faces.length > 0) {
        addLog("face", `检测到 ${faces.length} 张人脸 (${skinPixels} 像素)`);
      } else {
        addLog("info", `扫描中 (${skinPixels} 肤色像素)`);
      }
    }

    // Detect motion
    const motion = detectMotion(ctx, canvas.width, canvas.height);
    setMotionLevel(motion);
    drawMotion(ctx, motion);

    if (motion > 40) {
      addLog("motion", `运动检测: ${motion}%`);
    }

    // Draw timestamp
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 14px monospace";
    ctx.fillText(new Date().toLocaleTimeString(), 10, 25);
    ctx.font = "11px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText(new Date().toLocaleDateString(), 10, 42);

    // Draw stats
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 11px monospace";
    ctx.fillText(`FACES: ${faces.length}`, 10, canvas.height - 35);

    ctx.fillStyle = motion > 20 ? "#ff6b6b" : "#888";
    ctx.fillText(`MOTION: ${motion}%`, 10, canvas.height - 20);

    drawDebug(ctx);

    animationRef.current = requestAnimationFrame(detectFrame);
  };

  const startCamera = async () => {
    try {
      setIsLoading(true);
      // Use user facing camera for MacBook
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
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

      setTimeout(() => {
        detectFrame();
        addLog("info", "AI监控已启动");
        addLog("info", "请确保面部光线充足");
      }, 300);

      durationRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("摄像头访问失败:", error);
      alert("无法访问摄像头，请确保已授予权限");
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsMonitoring(false);
    setDuration(0);
    setFaceCount(0);
    setMotionLevel(0);
    setSkinPixels(0);
    previousFrameRef.current = null;
    frameCountRef.current = 0;

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const tempCanvas = document.createElement("canvas");
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return;

    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);
    if (canvasCtxRef.current) {
      ctx.drawImage(canvasRef.current, 0, 0);
    }

    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 20px monospace";
    ctx.fillText(new Date().toLocaleString(), 10, 30);

    ctx.font = "16px monospace";
    ctx.fillText(`Faces: ${faceCount} | Motion: ${motionLevel}%`, 10, 55);

    const link = document.createElement("a");
    link.download = `capture-${Date.now()}.png`;
    link.href = tempCanvas.toDataURL();
    link.click();

    setSnapshots((s) => s + 1);
    addLog("snapshot", "截图已保存");
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
              <div className={`w-3 h-3 rounded-full ${isMonitoring ? "bg-red-500 animate-pulse" : "bg-zinc-600"}`}></div>
              AI Capture Monitor
            </h1>
            <p className="text-xs text-zinc-400 mt-1">实时 AI 摄像监控</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDebugMode(!debugMode)}
              className={`text-xs px-2 py-1 rounded ${debugMode ? "bg-yellow-500/20 text-yellow-400" : "bg-zinc-800 text-zinc-400"}`}
            >
              {debugMode ? "调试开" : "调试关"}
            </button>
            <span className="text-xs text-zinc-400">{new Date().toLocaleTimeString()}</span>
            {isMonitoring && <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full">REC</span>}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-6xl space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Video Section */}
            <div className="lg:col-span-2 bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
              {!isMonitoring ? (
                <div className="aspect-video flex flex-col items-center justify-center text-center p-8">
                  <div className="w-24 h-24 mb-6 rounded-full bg-zinc-800 flex items-center justify-center">
                    <svg className="w-12 h-12 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-2">准备就绪</h2>
                  <p className="text-zinc-400 mb-4">点击下方按钮启动摄像头监控</p>
                  <div className="text-sm text-zinc-500 mb-6">
                    <p>• 使用 MacBook 前置摄像头</p>
                    <p>• 请确保面部光线充足</p>
                    <p>• 面对摄像头，距离适中</p>
                  </div>
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
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: "scaleX(-1)" }} />
                </div>
              )}

              {isMonitoring && (
                <div className="p-4 flex items-center justify-center gap-4 border-t border-zinc-800">
                  <button onClick={captureSnapshot} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    截图
                  </button>
                  <button onClick={stopCamera} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    停止
                  </button>
                </div>
              )}
            </div>

            {/* AI Results Panel */}
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex flex-col">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                AI 分析结果
              </h3>

              <div className="space-y-3 mb-4">
                <div className="bg-zinc-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-zinc-400 text-sm">检测人脸</span>
                    <span className={`text-2xl font-bold ${faceCount > 0 ? "text-green-400" : "text-zinc-500"}`}>{faceCount}</span>
                  </div>
                  <div className="text-xs text-zinc-500">最后检测: {lastDetection}</div>
                </div>

                <div className="bg-zinc-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-zinc-400 text-sm">运动强度</span>
                    <span className={`text-2xl font-bold ${motionLevel > 30 ? "text-red-400" : "text-zinc-400"}`}>{motionLevel}%</span>
                  </div>
                  <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-300" style={{ width: `${motionLevel}%` }}></div>
                  </div>
                </div>

                <div className="bg-zinc-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-zinc-400 text-sm">肤色像素</span>
                    <span className="text-lg font-bold text-zinc-300">{skinPixels}</span>
                  </div>
                  <div className="text-xs text-zinc-500">扫描到的可能肤色区域</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-800 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-white">{Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, "0")}</div>
                    <div className="text-xs text-zinc-500">运行时长</div>
                  </div>
                  <div className="bg-zinc-800 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-purple-400">{snapshots}</div>
                    <div className="text-xs text-zinc-500">截图数</div>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-[180px] bg-zinc-950 rounded-xl p-3 overflow-hidden">
                <div className="text-xs text-zinc-500 mb-2 pb-2 border-b border-zinc-800">检测日志</div>
                <div className="space-y-2 overflow-y-auto max-h-[140px]">
                  {detectionLogs.length === 0 ? (
                    <div className="text-center text-zinc-600 text-sm py-6">等待检测结果...</div>
                  ) : (
                    detectionLogs.map((log, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="text-zinc-500 font-mono shrink-0">{log.time}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 ${
                          log.type === "face" ? "bg-green-500/20 text-green-400" :
                          log.type === "motion" ? "bg-red-500/20 text-red-400" :
                          log.type === "snapshot" ? "bg-purple-500/20 text-purple-400" :
                          "bg-zinc-700 text-zinc-400"
                        }`}>{log.type.toUpperCase()}</span>
                        <span className="text-zinc-300 break-all">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <footer className="bg-zinc-900 border-t border-zinc-800 p-4">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className={`p-3 bg-zinc-800/50 rounded-xl ${faceCount > 0 ? "ring-2 ring-green-500/50" : ""}`}>
                  <div className="text-green-400 font-semibold">人脸检测</div>
                  <div className="text-xs text-zinc-500 mt-1">肤色聚类</div>
                </div>
                <div className={`p-3 bg-zinc-800/50 rounded-xl ${motionLevel > 20 ? "ring-2 ring-red-500/50" : ""}`}>
                  <div className="text-blue-400 font-semibold">运动检测</div>
                  <div className="text-xs text-zinc-500 mt-1">帧差分析</div>
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
