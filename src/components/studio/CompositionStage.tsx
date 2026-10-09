import React, { useEffect, useRef, useState } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { buildCompositionDocument } from '../../engine/composition/buildDocument';

interface CompositionStageProps {
  className?: string;
}

export const CompositionStage: React.FC<CompositionStageProps> = ({ className = '' }) => {
  const composition = useMooStore((s) => s.project.composition);
  const scenes = useMooStore((s) => s.project.scenes);
  const width = useMooStore((s) => s.project.composition?.width || s.project.width || 1080);
  const height = useMooStore((s) => s.project.composition?.height || s.project.height || 1920);
  const fps = useMooStore((s) => s.project.fps || 30);
  const projectId = useMooStore((s) => s.project.id);
  const currentFrame = useMooStore((s) => s.currentFrame);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [scale, setScale] = useState(1);
  const [isReady, setIsReady] = useState(false);

  const currentTime = currentFrame / fps;
  const latestTimeRef = useRef(currentTime);
  latestTimeRef.current = currentTime;
  const latestFrameRef = useRef(currentFrame);
  latestFrameRef.current = currentFrame;

  // Build srcdoc when minimal composition or scenes properties change
  const srcDoc = React.useMemo(() => {
    const minimalProject = {
      id: projectId,
      width,
      height,
      fps,
      scenes,
      composition
    } as any;
    return buildCompositionDocument(minimalProject);
  }, [composition, scenes, width, height, fps, projectId]);

  // Adjust container scale to fit responsive viewport smoothly
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth === 0 || clientHeight === 0) return;

      const scaleX = clientWidth / width;
      const scaleY = clientHeight / height;
      const bestScale = Math.min(scaleX, scaleY) * 0.96; // 4% padding
      setScale(Math.max(0.1, bestScale));
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [width, height]);

  // Handle postMessage communication from iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data;
      if (!data || !data.type) return;

      if (data.type === 'ready') {
        setIsReady(true);
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: 'seek',
            time: latestTimeRef.current,
            id: latestFrameRef.current
          },
          '*'
        );
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Seek iframe runtime when currentFrame / currentTime changes
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'seek',
          time: currentTime,
          id: currentFrame
        },
        '*'
      );
    }
  }, [currentFrame, currentTime, isReady]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden p-2 select-none ${className}`}
    >
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          transition: 'transform 0.15s ease-out'
        }}
        className="relative shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-border bg-black transition-transform duration-150 ease-out"
      >
        <iframe
          key={`${projectId}-${width}x${height}`}
          ref={iframeRef}
          srcDoc={srcDoc}
          title="MooScript Composition Stage"
          sandbox="allow-scripts"
          onLoad={() => {
            if (iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                {
                  type: 'seek',
                  time: latestTimeRef.current,
                  id: latestFrameRef.current
                },
                '*'
              );
            }
          }}
          className="w-full h-full border-0 pointer-events-none"
        />
      </div>
    </div>
  );
};
