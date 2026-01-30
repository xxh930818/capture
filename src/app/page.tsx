"use client";

import { useEffect, useRef, useState } from "react";

interface Face {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MotionArea {
  x: number;
  y: number;
  intensity: number;
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

  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const previousFrameRef = useRef<ImageData | null>(null);

  // Advanced face detection using skin tone and clustering
  const detectFaces = (ctx: CanvasRenderingContext2D, width: number, height: number): Face[] => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const skinPixels: { x: number; y: number }[] = [];

    // Skin tone detection with multiple ranges
    for (let y = 0; y < height; y += 8) {
      for (let x = 0; x < width; x += 8) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Multiple skin tone ranges
        const isSkin =
          // Light skin
          (r > 200 && g > 170 && b > 150 && r > g && r > b) ||
          // Medium skin
          (r > 150 && g > 100 && b > 80 && r > g * 1.2 && r - g > 30) ||
          // Darker skin
          (r > 100 && g > 70 && b > 60 && r > g * 1.1 && r - g > 20);

        if (isSkin) {
          skinPixels.push({ x, y });
        }
      }
    }

    // Cluster skin pixels to find faces
    const faces: Face[] = [];
    const visited = new Set<string>();

    skinPixels.forEach((pixel) => {
      const key = `${pixel.x},${pixel.y}`;
      if (visited.has(key)) return;

      // Find nearby skin pixels
      const cluster: { x: number; y: number }[] = [];
      const queue = [pixel];

      while (queue.length > 0 && cluster.length < 200) {
        const p = queue.shift()!;
        const pKey = `${p.x},${p.y}`;
        if (visited.has(pKey)) continue;

        visited.add(pKey);
        cluster.push(p);

        // Find neighbors
        skinPixels.forEach((sp) => {
          const dist = Math.sqrt((p.x - sp.x) ** 2 + (p.y - sp.y) ** 2);
          if (dist < 80) {
            const spKey = `${sp.x},${sp.y}`;
            if (!visited.has(spKey)) {
              queue.push(sp);
            }
          }
        });
      }

      // If cluster is large enough, it's a face
      if (cluster.length > 30) {
        const minX = Math.min(...cluster.map((p) => p.x));
        const maxX = Math.max(...cluster.map((p) => p.x));
        const minY = Math.min(...cluster.map((p) => p.y));
        const maxY = Math.max(...cluster.map((p) => p.y));

        const w = maxX - minX;
        const h = maxY - minY;

        // Check aspect ratio for face
        if (w > 40 && h > 50 && h / w > 1 && h / w < 2.5) {
          // Check if this overlaps with existing face
          const overlaps = faces.some((f) =>
            minX < f.x + f.width + 30 &&
            maxX + w > f.x - 30 &&
            minY < f.y + f.height + 30 &&
            maxY + h > f.y - 30
          );

          if (!overlaps) {
            faces.push({ x: minX - 20, y: minY - 30, width: w + 40, height: h + 60 });
          }
        }
      }
    });

    return faces.slice(0, 5);
  };

  // Motion detection
  const detectMotion = (ctx: CanvasRenderingContext2D, width: number, height: number): number => {
    const currentFrame = ctx.getImageData(0, 0, Math.min(width, 320), Math.min(height, 180));
    const prevFrame = previousFrameRef.current;

    if (!prevFrame) {
      previousFrameRef.current = currentFrame;
      return 0;
    }

    const current = currentFrame.data;
    const previous = prevFrame.data;
    let motionPixels = 0;

    for (let i = 0; i < current.length; i += 16) { // Sample every 4th pixel
      const diff = Math.abs(current[i] - previous[i]) +
                   Math.abs(current[i + 1] - previous[i + 1]) +
                   Math.abs(current[i + 2] - previous[i + 2]);

      if (diff > 50) {
        motionPixels++;
      }
    }

    previousFrameRef.current = currentFrame;
    return Math.min(100, Math.round((motionPixels / (current.length / 16)) * 400));
  };

  // Draw face boxes with corner accents and details
  const drawFaces = (ctx: CanvasRenderingContext2D, faces: Face[]) => {
    const cornerSize = 14;
    const tickLength = 8;

    faces.forEach((face, index) => {
      const colors = ["#00ff88", "#00d4ff", "#ff6b6b", "#ffd93d", "#a855f7"];
      const color = colors[index % colors.length];

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;

      // Draw corner brackets
      // Top-left
      ctx.beginPath();
      ctx.moveTo(face.x + tickLength, face.y);
      ctx.lineTo(face.x, face.y);
      ctx.lineTo(face.x, face.y + tickLength + cornerSize);
      ctx.stroke();

      // Top-right
      ctx.beginPath();
      ctx.moveTo(face.x + face.width - tickLength, face.y);
      ctx.lineTo(face.x + face.width, face.y);
      ctx.lineTo(face.x + face.width, face.y + tickLength + cornerSize);
      ctx.stroke();

      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(face.x, face.y + face.height - tickLength - cornerSize);
      ctx.lineTo(face.x, face.y + face.height);
      ctx.lineTo(face.x + tickLength, face.y + face.height);
      ctx.stroke();

      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(face.x + face.width - tickLength, face.y + face.height);
      ctx.lineTo(face.x + face.width, face.y + face.height);
      ctx.lineTo(face.x + face.width, face.y + face.height - tickLength - cornerSize);
      ctx.stroke();

      // Draw face label background
      ctx.fillStyle = color;
      ctx.fillRect(face.x, face.y - 20, 60, 18);

      // Draw face label text
      ctx.fillStyle = "#000";
      ctx.font = "bold 11px monospace";
      ctx.fillText(`FACE ${index + 1}`, face.x + 5, face.y - 6);
    });

    setFaceCount(faces.length);
  };

  // Draw motion indicators
  const drawMotion = (ctx: CanvasRenderingContext2D, motion: number) => {
    if (motion < 10) return;

    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // Draw motion indicator bars on the right side
    const barCount = 10;
    const barHeight = 4;
    const barSpacing = 8;
    const startX = width - 20;
    const startY = 20;

    for (let i = 0; i < barCount; i++) {
      const threshold = (i + 1) * 10;
      const isActive = motion >= threshold;

      ctx.fillStyle = isActive ? "#ff6b6b" : "#333";
      ctx.fillRect(startX, startY + i * (barHeight + barSpacing), 8, barHeight);
    }

    // Draw motion percentage
    ctx.fillStyle = "#ff6b6b";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`MOTION ${motion}%`, width - 10, height - 10);
    ctx.textAlign = "left";
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

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Detect and draw faces
    const faces = detectFaces(ctx, canvas.width, canvas.height);
    drawFaces(ctx, faces);

    // Detect and draw motion
    const motion = detectMotion(ctx, canvas.width, canvas.height);
    setMotionLevel(motion);
    drawMotion(ctx, motion);

    // Draw timestamp
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 14px monospace";
    const timeStr = new Date().toLocaleTimeString();
    ctx.fillText(timeStr, 10, 25);

    // Draw date
    ctx.font = "11px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText(new Date().toLocaleDateString(), 10, 42);

    // Draw stats overlay
    ctx.fillStyle = "#00ff88";
    ctx.font = "11px monospace";
    ctx.fillText(`FACES: ${faceCount}`, 10, canvas.height - 35);

    ctx.fillStyle = motion > 20 ? "#ff6b6b" : "#888";
    ctx.fillText(`MOTION: ${motion}%`, 10, canvas.height - 20);

    animationRef.current = requestAnimationFrame(detectFrame);
  };

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

      // Start detection loop
      setTimeout(() => {
        detectFrame();
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
    previousFrameRef.current = null;

    // Clear canvas
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

    // Draw video
    ctx.drawImage(video, 0, 0);

    // Draw detection overlay
    if (canvasCtxRef.current) {
      ctx.drawImage(canvasRef.current, 0, 0);
    }

    // Add timestamp
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 20px monospace";
    ctx.fillText(new Date().toLocaleString(), 10, 30);

    // Add stats
    ctx.font = "16px monospace";
    ctx.fillText(`Faces: ${faceCount} | Motion: ${motionLevel}%`, 10, 55);

    const link = document.createElement("a");
    link.download = `capture-${Date.now()}.png`;
    link.href = tempCanvas.toDataURL();
    link.click();

    setSnapshots((s) => s + 1);
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
          {isMonitoring && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400">{new Date().toLocaleTimeString()}</span>
              {faceCount > 0 && (
                <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                  {faceCount} 人脸
                </span>
              )}
              {motion > 20 && (
                <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></span>
                  运动 {motion}%
                </span>
              )}
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
                <p className="text-zinc-400 mb-2">点击下方按钮启动摄像头监控</p>
                <p className="text-zinc-500 text-sm mb-6">支持人脸检测、运动捕捉、截图保存</p>
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
                {/* Detection overlay */}
                <div className="absolute top-3 left-3 flex flex-col gap-2">
                  {faceCount > 0 && (
                    <div className="bg-green-500/90 text-white text-xs px-2 py-1 rounded flex items-center gap-1 shadow-lg">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                      {faceCount} 人脸检测
                    </div>
                  )}
                  {motion > 20 && (
                    <div className="bg-red-500/90 text-white text-xs px-2 py-1 rounded flex items-center gap-1 shadow-lg">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                      运动 {motion}%
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {isMonitoring && (
            <>
              <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, "0")}
                    </div>
                    <div className="text-xs text-zinc-500">运行时长</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">{faceCount}</div>
                    <div className="text-xs text-zinc-500">检测人脸</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${motion > 20 ? "text-red-400" : "text-zinc-400"}`}>{motion}%</div>
                    <div className="text-xs text-zinc-500">运动强度</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-400">{snapshots}</div>
                    <div className="text-xs text-zinc-500">截图数</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={captureSnapshot}
                  className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  截图
                </button>
                <button
                  onClick={stopCamera}
                  className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  停止
                </button>
              </div>
            </>
          )}

          <footer className="bg-zinc-900 border-t border-zinc-800 p-4">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className={`p-3 bg-zinc-800/50 rounded-xl transition-all ${faceCount > 0 ? "ring-2 ring-green-500/50" : ""}`}>
                  <div className="text-green-400 font-semibold">人脸检测</div>
                  <div className="text-xs text-zinc-500 mt-1">智能聚类</div>
                </div>
                <div className={`p-3 bg-zinc-800/50 rounded-xl transition-all ${motion > 20 ? "ring-2 ring-red-500/50" : ""}`}>
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
