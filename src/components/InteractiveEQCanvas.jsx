import React, { useEffect, useRef, useState, useCallback } from 'react';

const BANDS = [
  { index: 0, color: '#e55353', label: 'LC' },
  { index: 1, color: '#e58e45', label: 'LS' },
  { index: 2, color: '#d9a736', label: 'PK' },
  { index: 3, color: '#4eb870', label: 'HS' },
  { index: 4, color: '#4a90e2', label: 'HC' },
];

export function InteractiveEQCanvas({ trackPlayer, isPlaying, eqParams, onEqChange }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const [activeNode, setActiveNode] = useState(null);
  const containerRef = useRef(null);

  // Map frequency to x coordinate (log scale)
  const freqToX = (freq, width) => {
    const minF = Math.log10(20);
    const maxF = Math.log10(20000);
    const f = Math.log10(Math.max(20, Math.min(20000, freq)));
    return ((f - minF) / (maxF - minF)) * width;
  };

  // Map x coordinate to frequency (log scale)
  const xToFreq = (x, width) => {
    const minF = Math.log10(20);
    const maxF = Math.log10(20000);
    const pct = Math.max(0, Math.min(1, x / width));
    return Math.pow(10, minF + pct * (maxF - minF));
  };

  // Map gain (-24 to 24 dB) to y coordinate
  const gainToY = (gain, height) => {
    const pct = (gain + 24) / 48; // 0 to 1 where 0 is -24dB and 1 is +24dB
    return height - (pct * height);
  };

  // Map y coordinate to gain
  const yToGain = (y, height) => {
    const pct = 1 - Math.max(0, Math.min(1, y / height));
    return -24 + (pct * 48);
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Dark charcoal background like Pro-Q
    ctx.fillStyle = '#181818';
    ctx.fillRect(0, 0, w, h);

    // 1. Draw Grid & Labels
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // Vertical Freq Grid
    [20, 50, 100, 200, 500, 1000, 5000, 10000, 20000].forEach(f => {
      const x = freqToX(f, w);
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
      const label = f >= 1000 ? (f === 1000 ? '1k' : `${f/1000}k`) : `${f}`;
      ctx.fillText(label, x + 4, h - 8);
    });
    
    // Horizontal dB Grid (right side)
    [-12, -9, -6, -3, 3, 6, 9, 12].forEach(db => {
      const y = gainToY(db, h);
      ctx.moveTo(0, y); ctx.lineTo(w, y);
      ctx.fillText(`${db > 0 ? '+' : ''}${db}`, w - 20, y + 4);
    });
    ctx.stroke();

    // Vibrant Orange 0dB line
    ctx.beginPath();
    ctx.strokeStyle = '#d9972b'; // Pro-Q orange
    ctx.lineWidth = 1.5;
    ctx.moveTo(0, h/2); ctx.lineTo(w, h/2);
    ctx.stroke();

    // 2. Draw Spectrum (FFT)
    if (trackPlayer && isPlaying) {
      const data = new Uint8Array(trackPlayer.analyserNode?.frequencyBinCount || 0);
      trackPlayer.getFrequencyData(data);
      const len = data.length;
      const maxBins = Math.floor(len * 0.85);

      ctx.beginPath();
      ctx.moveTo(0, h);
      
      for (let i = 0; i < maxBins; i++) {
        const val = data[i] || 0;
        const pct = Math.pow(val / 255, 1.2);
        const y = h - (pct * h * 0.9);
        const freq = (i / len) * (trackPlayer.ctx.sampleRate / 2);
        const x = freqToX(Math.max(20, freq), w);
        
        if (i === 0) ctx.lineTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      
      // Pro-Q fills the spectrum with a solid medium grey
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      
      // And a solid white jagged top line
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 3. Draw EQ Curve
    if (trackPlayer && eqParams) {
      const numPoints = 250;
      const freqs = new Float32Array(numPoints);
      for (let i = 0; i < numPoints; i++) {
        freqs[i] = xToFreq((i / numPoints) * w, w);
      }
      
      const magResponse = new Float32Array(numPoints);
      const phaseResponse = new Float32Array(numPoints);
      trackPlayer.getEqResponse(freqs, magResponse, phaseResponse);

      ctx.beginPath();
      ctx.moveTo(0, h/2);
      for (let i = 0; i < numPoints; i++) {
        const db = 20 * Math.log10(Math.max(magResponse[i], 0.0001));
        const y = gainToY(Math.max(-24, Math.min(24, db)), h);
        const x = freqToX(freqs[i], w);
        ctx.lineTo(x, y);
      }
      
      // Pro-Q curve is a soft white line
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Pro-Q fill is dark transparent grey beneath the curve
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fill();
    }

    // 4. Draw Interactive Nodes
    if (eqParams) {
      BANDS.forEach(band => {
        const param = eqParams[band.index];
        if (!param) return;
        const x = freqToX(param.freq, w);
        const y = gainToY(param.gain, h);

        const isActive = activeNode === band.index;

        // Pro-Q nodes are subtle circles, active is yellow/orange
        ctx.beginPath();
        ctx.arc(x, y, isActive ? 6 : 5, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? '#d9972b' : 'rgba(255,255,255,0.4)';
        ctx.fill();
        
        // Draw Q width indicator if active
        if (isActive && (band.type === 'peaking' || band.type === 'lowshelf' || band.type === 'highshelf')) {
          const qW = Math.max(10, 100 / param.Q);
          ctx.beginPath();
          ctx.moveTo(x - qW/2, y);
          ctx.lineTo(x + qW/2, y);
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.stroke();
          
          // Draw floating label (Pro-Q style floating text)
          const labelTxt = `${Math.round(param.freq)} Hz  |  ${param.gain > 0 ? '+' : ''}${param.gain.toFixed(1)} dB`;
          const tw = ctx.measureText(labelTxt).width;
          ctx.fillStyle = 'rgba(24,24,24,0.9)';
          ctx.fillRect(x - tw/2 - 8, y + 12, tw + 16, 20);
          ctx.strokeStyle = 'rgba(255,255,255,0.1)';
          ctx.strokeRect(x - tw/2 - 8, y + 12, tw + 16, 20);
          
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillText(labelTxt, x - tw/2, y + 25);
        }
      });
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [trackPlayer, isPlaying, eqParams, activeNode]);

  useEffect(() => {
    draw();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [draw]);

  // Handle Mouse Events for Dragging
  const handlePointerDown = (e) => {
    if (!canvasRef.current || !eqParams) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find closest node within 15px radius
    let closestNode = null;
    let minDist = 15;

    BANDS.forEach(band => {
      const param = eqParams[band.index];
      const nx = freqToX(param.freq, rect.width);
      const ny = gainToY(param.gain, rect.height);
      const dist = Math.hypot(nx - x, ny - y);
      if (dist < minDist) {
        minDist = dist;
        closestNode = band.index;
      }
    });

    if (closestNode !== null) {
      setActiveNode(closestNode);
      e.target.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e) => {
    if (activeNode === null || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const freq = xToFreq(x, rect.width);
    const gain = yToGain(y, rect.height);

    onEqChange(activeNode, { freq, gain });
  };

  const handlePointerUp = (e) => {
    setActiveNode(null);
    e.target.releasePointerCapture(e.pointerId);
  };

  // Wheel to adjust Q factor
  const handleWheel = (e) => {
    if (activeNode === null || !eqParams) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    let newQ = Math.max(0.1, Math.min(10, eqParams[activeNode].Q + delta));
    onEqChange(activeNode, { Q: newQ });
  };

  return (
    <div className="interactive-eq-container" ref={containerRef} style={{ position: 'relative', width: '100%', height: 140, background: '#101113', borderRadius: 6, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        width={containerRef.current ? containerRef.current.clientWidth : 400}
        height={140}
        style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: activeNode !== null ? 'grabbing' : 'default' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      />
      
      {/* Node labels */}
      {eqParams && BANDS.map(band => {
        const param = eqParams[band.index];
        if (!param) return null;
        return (
          <div key={band.index} style={{
            position: 'absolute',
            bottom: 4,
            left: `${(Math.log10(param.freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * 100}%`,
            transform: 'translateX(-50%)',
            fontSize: '9px', fontFamily: 'var(--font-mono)', color: band.color, pointerEvents: 'none'
          }}>
            {Math.round(param.freq)}Hz
          </div>
        );
      })}
    </div>
  );
}
