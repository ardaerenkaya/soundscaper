import React, { useEffect, useRef } from 'react';

export function VisualizerCanvas({ audioEngine, isPlaying }) {
  const ref = useRef(null);
  const raf = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (audioEngine && isPlaying) {
        const data = audioEngine.getFrequencyData();
        const len = data.length;
        // Cap the frequencies to only show the most active range (skip the very high empty bands)
        const maxBins = Math.floor(len * 0.85);
        
        ctx.beginPath();
        ctx.moveTo(0, h);
        
        for (let i = 0; i < maxBins; i++) {
          const val = data[i] || 0;
          // Add a subtle curve to the visual height so peaks stand out more realistically
          const pct = Math.pow(val / 255, 1.2);
          const y = h - (pct * h * 0.9);
          const x = (i / (maxBins - 1)) * w;
          
          // Use smooth curve interpolation
          if (i === 0) {
            ctx.lineTo(x, y);
          } else {
            const prevVal = data[i - 1] || 0;
            const prevPct = Math.pow(prevVal / 255, 1.2);
            const prevY = h - (prevPct * h * 0.9);
            const prevX = ((i - 1) / (maxBins - 1)) * w;
            
            const xc = (prevX + x) / 2;
            const yc = (prevY + y) / 2;
            ctx.quadraticCurveTo(prevX, prevY, xc, yc);
          }
        }
        
        ctx.lineTo(w, h);
        ctx.closePath();

        // Warm studio gradient fill
        const grad = ctx.createLinearGradient(0, h, 0, 0);
        grad.addColorStop(0, 'rgba(229,142,69,0.05)');
        grad.addColorStop(0.5, 'rgba(229,142,69,0.3)');
        grad.addColorStop(1, 'rgba(217,167,54,0.6)');

        ctx.fillStyle = grad;
        ctx.fill();

        // Vibrant edge stroke
        ctx.strokeStyle = 'rgba(229, 142, 69, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

      } else {
        // Idle center line
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(w, h);
        ctx.stroke();
      }

      raf.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [audioEngine, isPlaying]);

  return (
    <canvas
      ref={ref}
      width={280}
      height={42}
      className="visualizer-canvas"
    />
  );
}
