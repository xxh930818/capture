"use client";

import { useEffect, useRef, useState } from "react";
import * as posedetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";

interface Face {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PoseKeypoint {
  x: number;
  y: number;
  score?: number;
  name?: string;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [faceCount, setFaceCount] = useState(0);
  const [poseDetected, setPoseDetected] = useState(false);
  const [confidence, setConfidence] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);
  const detectorRef = useRef<posedetection.PoseDetector | null>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Load pose detection model
  const loadPoseModel = async () => {
    try {
      setIsModelLoading(true);
      const model = posedetection.SupportedModels.MoveNet;
      const detectorConfig = {
        modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      };
      detectorRef.current = await posedetection.createDetector(model, detectorConfig);
      setIsModelLoading(false);
    } catch (error) {
      console.error("模型加载失败:", error);
      setIsModelLoading(false);
    }
  };

  // Simple face detection using color and motion
  const detectFaces = (ctx: CanvasRenderingContext2D, width: number, height: number): Face[] => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const faces: Face[] = [];

    // Simple skin tone detection
    for (let y = 0; y < height; y += 20) {
      for (let x = 0; x < width; x += 20) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Skin tone detection (simplified)
        const isSkin = r > 95 && g > 40 && b > 20 &&
                      r > g && r > b &&
                      Math.abs(r - g) > 15 &&
                      r - g < 100;

        if (isSkin) {
          // Check if we already have a face nearby
          const existing = faces.find(f =>
            x > f.x - 50 && x < f.x + f.width + 50 &&
            y > f.y - 50 && y < f.y + f.height + 50
          );

          if (!existing && faces.length < 5) {
            faces.push({ x: x - 40, y: y - 50, width: 80, height: 100 });
          }
        }
      }
    }

    return faces;
  };

  // Draw face boxes
  const drawFaces = (ctx: CanvasRenderingContext2D, faces: Face[]) => {
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 2;

    faces.forEach(face => {
      ctx.strokeRect(face.x, face.y, face.width, face.height);

      // Draw corner accents
      const cornerSize = 10;
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 3;

      // Top-left
      ctx.beginPath();
      ctx.moveTo(face.x, face.y + cornerSize);
      ctx.lineTo(face.x, face.y);
      ctx.lineTo(face.x + cornerSize, face.y);
      ctx.stroke();

      // Top-right
      ctx.beginPath();
      ctx.moveTo(face.x + face.width - cornerSize, face.y);
      ctx.lineTo(face.x + face.width, face.y);
      ctx.lineTo(face.x + face.width, face.y + cornerSize);
      ctx.stroke();

      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(face.x, face.y + face.height - cornerSize);
      ctx.lineTo(face.x, face.y + face.height);
      ctx.lineTo(face.x + cornerSize, face.y + face.height);
      ctx.stroke();

      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(face.x + face.width - cornerSize, face.y + face.height);
      ctx.lineTo(face.x + face.width, face.y + face.height);
      ctx.lineTo(face.x + face.width, face.y + face.height - cornerSize);
      ctx.stroke();
    });

    setFaceCount(faces.length);
  };

  // Draw pose skeleton
  const drawPose = (ctx: CanvasRenderingContext2D, keypoints: PoseKeypoint[]) => {
    const connections = [
      [0, 1], [0, 2], // head
      [1, 3], [2, 4], // arms
      [3, 5], [4, 6], // lower arms
      [5, 6], // hands
      [5, 7], [6, 8], // to hips
      [7, 8], // hips
      [7, 9], [8, 10], // legs
      [9, 11], [10, 12], // lower legs
    ];

    // Draw connections
    ctx.strokeStyle = "#ff6b6b";
    ctx.lineWidth = 2;

    connections.forEach(([i, j]) => {
      const kp1 = keypoints[i];
      const kp2 = keypoints[j];
      if (kp1 && kp2 && kp1.score && kp2.score && kp1.score > 0.3 && kp2.score > 0.3) {
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.stroke();
      }
    });

    // Draw keypoints
    keypoints.forEach((kp, i) => {
      if (kp.score && kp.score > 0.3) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = i < 4 ? "#4ecdc4" : "#ff6b6b";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    setPoseDetected(keypoints.some(kp => kp.score && kp.score > 0.5));
  };

  // Detection loop
  const detectFrame = async () => {
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

    // Detect faces
    const faces = detectFaces(ctx, canvas.width, canvas.height);
    drawFaces(ctx, faces);

    // Detect pose
    if (detectorRef.current && video.readyState >= 2) {
      try {
        const poses = await detectorRef.current.estimatePoses(video);
        if (poses.length > 0) {
          const keypoints = poses[0].keypoints.map(kp => ({
            x: kp.x,
            y: kp.y,
            score: kp.score,
          }));
          drawPose(ctx, keypoints);
          const maxConf = Math.max(...keypoints.map(k => k.score || 0));
          setConfidence(Math.round(maxConf * 100));
        }
      } catch (e) {
        // Silent retry on detection error
      }
    }

    // Draw timestamp
    ctx.fillStyle = "#00ff88";
    ctx.font = "14px monospace";
    ctx.fillText(new Date().toLocaleTimeString(), 10, 25);

    // Draw status indicators
    if (faceCount > 0) {
      ctx.fillStyle = "#00ff88";
      ctx.font = "12px monospace";
      ctx.fillText(`FACES: ${faceCount}`, 10, canvas.height - 30);
    }
    if (poseDetected) {
      ctx.fillStyle = "#ff6b6b";
      ctx.fillText(`POSE: ${confidence}%`, 10, canvas.height - 15);
    }

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
      }, 500);

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
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsMonitoring(false);
    setDuration(0);
    setFaceCount(0);
    setPoseDetected(false);
    setConfidence(0);

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
    ctx.font = "20px monospace";
    ctx.fillText(new Date().toLocaleString(), 10, 30);

    const link = document.createElement("a");
    link.download = `capture-${Date.now()}.png`;
    link.href = tempCanvas.toDataURL();
    link.click();
  };

  useEffect(() => {
    loadPoseModel();
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
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400">{new Date().toLocaleTimeString()}</span>
              {faceCount > 0 && (
                <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                  {faceCount} 人脸
                </span>
              )}
              {poseDetected && (
                <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                  姿态 {confidence}%
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
                {isModelLoading && (
                  <p className="text-yellow-400 text-sm mb-4">正在加载 AI 模型...</p>
                )}
                <button
                  onClick={startCamera}
                  disabled={isLoading || isModelLoading}
                  className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 text-white font-semibold rounded-xl transition-colors"
                >
                  {isLoading ? "启动中..." : isModelLoading ? "模型加载中..." : "启动监控"}
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
                    <div className="bg-green-500/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                      {faceCount} 人脸检测中
                    </div>
                  )}
                  {poseDetected && (
                    <div className="bg-red-500/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                      姿态识别 {confidence}%
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
                    <div className="text-2xl font-bold text-white">{Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}</div>
                    <div className="text-xs text-zinc-500">运行时长</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">{faceCount}</div>
                    <div className="text-xs text-zinc-500">检测人脸</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-400">{poseDetected ? confidence + "%" : "--"}</div>
                    <div className="text-xs text-zinc-500">姿态置信度</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-400">REC</div>
                    <div className="text-xs text-zinc-500">状态</div>
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
                <div className={`p-3 bg-zinc-800/50 rounded-xl transition-all ${faceCount > 0 ? 'ring-2 ring-green-500/50' : ''}`}>
                  <div className="text-green-400 font-semibold">人脸检测</div>
                  <div className="text-xs text-zinc-500 mt-1">实时识别</div>
                </div>
                <div className={`p-3 bg-zinc-800/50 rounded-xl transition-all ${poseDetected ? 'ring-2 ring-red-500/50' : ''}`}>
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
