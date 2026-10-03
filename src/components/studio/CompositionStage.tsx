import React, { useEffect, useRef, useState } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { buildCompositionDocument } from '../../engine/composition/buildDocument';

interface CompositionStageProps {
  className?: string;
}

export const CompositionStage: React.FC<CompositionStageProps> = ({ className = '' }) => {
  const { project, currentFrame } = useMooStore();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [scale, setScale] = useState(1);
  const [isReady, setIsReady] = useState(false);

  const fps = project.fps || 30;
  const currentTime = currentFrame / fps;

  const width = project.composition?.width || project.width || 1080;
  const height = project.composition?.height || project.height || 1920;
  // Build srcdoc when project composition or scenes change
  const srcDoc = React.useMemo(() => {
    return buildCompositionDocument(project);
  }, [project]);

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
      const data = e.data;
      if (!data || !data.type) return;

      if (data.type === 'ready') {
        setIsReady(true);
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
          transformOrigin: 'center center'
        }}
        className="relative shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-border bg-black transition-transform duration-75 ease-out"
      >
        <iframe
          key={
            project.composition
              ? `${project.composition.id}-${project.composition.updatedAt || ''}-${project.composition.scenes?.length || 0}`
              : 'comp-default'
          }
          ref={iframeRef}
          srcDoc={srcDoc}
          title="MooScript Composition Stage"
          sandbox="allow-scripts allow-same-origin"
          onLoad={() => {
            if (iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                {
                  type: 'seek',
                  time: currentTime,
                  id: currentFrame
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
