import React from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

interface DetectionResultProps {
  type: 'face' | 'pose' | 'object';
  confidence: number;
  label: string;
  timestamp?: Date;
}

export function DetectionResult({ type, confidence, label, timestamp }: DetectionResultProps) {
  const typeConfig = {
    face: { color: 'success', label: '人脸' },
    pose: { color: 'info', label: '姿态' },
    object: { color: 'warning', label: '物体' },
  };

  const config = typeConfig[type];

  return (
    <Card className="bg-black/50 backdrop-blur-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant={config.color as any}>{config.label}</Badge>
            <span className="text-white text-sm font-medium">{label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-xs font-mono">
              {Math.round(confidence * 100)}%
            </span>
          </div>
        </div>
        {timestamp && (
          <div className="text-zinc-500 text-xs mt-2 font-mono">
            {timestamp.toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface DetectionListProps {
  detections: DetectionResultProps[];
  maxItems?: number;
}

export function DetectionList({ detections, maxItems = 5 }: DetectionListProps) {
  const displayDetections = detections.slice(0, maxItems);

  if (displayDetections.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>等待检测结果...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayDetections.map((detection, index) => (
        <DetectionResult key={index} {...detection} />
      ))}
    </div>
  );
}
