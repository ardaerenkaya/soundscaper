import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, X, ExternalLink, Loader2, Sliders } from 'lucide-react';
import { InteractiveEQCanvas } from './InteractiveEQCanvas';

function MeterBar({ trackPlayer }) {
  const barRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const updateMeter = () => {
      if (barRef.current && trackPlayer) {
        const { peak } = trackPlayer.getMeterData();
        // db range -60 to 0
        const pct = Math.max(0, Math.min(100, (peak + 60) * (100 / 60)));
        barRef.current.style.width = `${pct}%`;
        barRef.current.style.background = peak >= -0.1 ? 'var(--red)' : peak >= -6 ? 'var(--yellow)' : 'var(--green)';
      }
      rafRef.current = requestAnimationFrame(updateMeter);
    };
    updateMeter();
    return () => cancelAnimationFrame(rafRef.current);
  }, [trackPlayer]);

  return (
    <div style={{ width: '100%', height: 4, background: '#111', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
      <div ref={barRef} style={{ width: '0%', height: '100%', background: 'var(--green)', transition: 'none' }} />
    </div>
  );
}

function WaveformDisplay({ trackPlayer, isPlaying }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const [waveform, setWaveform] = useState(null);

  useEffect(() => {
    if (!trackPlayer?.audioBuffer) return;
    const buffer = trackPlayer.audioBuffer;
    
    // We will compute peaks for L and R channels if stereo, else just L.
    const numChannels = buffer.numberOfChannels;
    const step = Math.ceil(buffer.length / 300);
    const pL = new Float32Array(300);
    const pR = numChannels > 1 ? new Float32Array(300) : null;
    
    const dataL = buffer.getChannelData(0);
    const dataR = numChannels > 1 ? buffer.getChannelData(1) : null;

    for (let i = 0; i < 300; i++) {
      let maxL = 0;
      let maxR = 0;
      for (let j = 0; j < step && (i * step + j) < buffer.length; j++) {
        const idx = i * step + j;
        const valL = Math.abs(dataL[idx]);
        if (valL > maxL) maxL = valL;
        
        if (dataR) {
          const valR = Math.abs(dataR[idx]);
          if (valR > maxR) maxR = valR;
        }
      }
      pL[i] = maxL;
      if (pR) pR[i] = maxR;
    }
    setWaveform({ left: pL, right: pR });
  }, [trackPlayer?.audioBuffer]);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas || !waveform) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      
      ctx.clearRect(0, 0, w, h);
      
      const { left, right } = waveform;
      const barW = w / left.length;
      
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      
      if (right) {
        // Stereo: L top, R bottom
        const halfH = h / 2;
        for (let i = 0; i < left.length; i++) {
          const bhL = Math.max(1, left[i] * halfH);
          ctx.fillRect(i * barW, halfH - bhL, Math.max(1, barW - 0.5), bhL);
          
          const bhR = Math.max(1, right[i] * halfH);
          ctx.fillRect(i * barW, halfH, Math.max(1, barW - 0.5), bhR);
        }
      } else {
        // Mono: Center
        for (let i = 0; i < left.length; i++) {
          const bh = Math.max(1, left[i] * h);
          ctx.fillRect(i * barW, (h - bh) / 2, Math.max(1, barW - 0.5), bh);
        }
      }

      // Draw Playhead
      if (isPlaying && trackPlayer?.isPlaying) {
        const duration = trackPlayer.audioBuffer?.duration || 1;
        // Accurate time elapsed calculation
        let elapsed = trackPlayer.ctx.currentTime - trackPlayer.startedAt;
        if (elapsed < 0) elapsed = 0;
        
        // Wrap around if looping
        elapsed = elapsed % duration;
        
        const x = (elapsed / duration) * w;
        
        ctx.fillStyle = 'var(--accent)';
        ctx.fillRect(x, 0, 2, h);
      }
      
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [waveform, isPlaying, trackPlayer]);

  const handleClick = (e) => {
    if (!trackPlayer?.audioBuffer || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    const offset = pct * trackPlayer.audioBuffer.duration;
    
    // Seek
    trackPlayer.seek(offset);
  };

  return (
    <div style={{ width: '100%', height: 32, background: '#101113', borderRadius: 4, marginTop: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={32} 
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'pointer' }} 
        onClick={handleClick}
        title="Click to seek"
      />
    </div>
  );
}

export function LayerCard({
  layer, trackPlayer, isPlaying,
  onUpdateVol, onUpdatePan, onUpdateEq, onUpdatePitch, onUpdateTransform,
  onToggleMute, onToggleSolo, onRemoveLayer, onSwapSound,
}) {
  const [swapping, setSwapping] = useState(false);
  const [showEq, setShowEq] = useState(false);

  const handleSwap = async () => {
    setSwapping(true);
    await onSwapSound(layer.id);
    setSwapping(false);
  };

  const badgeClass =
    layer.category === 'event' ? 'badge-event' :
    layer.category === 'action' ? 'badge-action' : 'badge-field';

  const panLabel =
    layer.pan === 0 ? 'C' :
    layer.pan < 0 ? `L${Math.abs(Math.round(layer.pan * 100))}` :
    `R${Math.round(layer.pan * 100)}`;

  const transformPct = Math.round((layer.transform || 0) * 100);

  // Provide default EQ params if they don't exist
  const defaultEq = [
    { type: 'highpass', freq: 20, gain: 0, Q: 0.7 },
    { type: 'lowshelf', freq: 100, gain: 0, Q: 0.7 },
    { type: 'peaking', freq: 1000, gain: 0, Q: 1.0 },
    { type: 'highshelf', freq: 5000, gain: 0, Q: 0.7 },
    { type: 'lowpass', freq: 20000, gain: 0, Q: 0.7 }
  ];
  const currentEqParams = layer.eqBands || defaultEq;

  return (
    <div className="layer-card" style={{ paddingBottom: showEq ? 10 : undefined }}>
      {/* Header */}
      <div className="layer-header">
        <div className="layer-title-group">
          <span className={`layer-badge ${badgeClass}`}>{layer.category}</span>
          <span className="layer-title">{layer.title}</span>
          <span className="layer-query">"{layer.query}"</span>
        </div>
        <div className="layer-status">
          {layer.isLoading ? (
            <><Loader2 size={12} className="spin" /> <span style={{ color: 'var(--amber)' }}>loading…</span></>
          ) : (
            <><span className="led led-green" /> ready</>
          )}
        </div>
      </div>

      {/* Sound metadata */}
      {layer.soundDetails ? (
        <div className="layer-meta">
          <span className="sound-name" title={layer.soundDetails.title}>{layer.soundDetails.title}</span>
          <span className="dot">·</span>
          <span>{layer.soundDetails.author}</span>
          <span className="dot">·</span>
          <a href={layer.soundDetails.url || layer.soundDetails.freesoundUrl} target="_blank" rel="noopener noreferrer">
            {layer.soundDetails.license === 'http://creativecommons.org/publicdomain/zero/1.0/' ? 'CC0' : 'License'} <ExternalLink size={10} />
          </a>
          <span className="dot">·</span>
          <span>{layer.soundDetails.duration}s</span>
          <WaveformDisplay trackPlayer={trackPlayer} isPlaying={isPlaying} />
        </div>
      ) : (
        <div className="layer-meta">
          <span style={{ color: 'var(--text-dim)' }}>Searching Provider…</span>
        </div>
      )}

      {/* Controls */}
      <div className="layer-controls">
        <div className="control-group">
          <div className="control-label">
            <span className="control-label-name">Vol</span>
            <span className="control-label-value">{layer.vol} dB</span>
          </div>
          <input
            type="range" min="-30" max="6" step="1"
            value={layer.vol}
            onChange={e => onUpdateVol(layer.id, parseFloat(e.target.value))}
          />
          <MeterBar trackPlayer={trackPlayer} />
        </div>

        <div className="control-group">
          <div className="control-label">
            <span className="control-label-name">Pan</span>
            <span className="control-label-value">{panLabel}</span>
          </div>
          <input
            type="range" min="-1" max="1" step="0.05"
            value={layer.pan}
            onChange={e => onUpdatePan(layer.id, parseFloat(e.target.value))}
          />
        </div>

        <div className="control-group">
          <div className="control-label">
            <span className="control-label-name">EQ</span>
            <span className="control-label-value" style={{ color: showEq ? 'var(--accent)' : 'inherit' }}>{showEq ? 'OPEN' : 'CLOSED'}</span>
          </div>
          <button 
            onClick={() => setShowEq(!showEq)} 
            style={{ width: '100%', height: '14px', background: showEq ? 'var(--accent)' : 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: showEq ? '#000' : 'var(--text-muted)' }}
          >
            <Sliders size={10} />
          </button>
        </div>

        <div className="control-group">
          <div className="control-label">
            <span className="control-label-name">Pitch</span>
            <span className="control-label-value">{layer.pitch.toFixed(2)}×</span>
          </div>
          <input
            type="range" min="0.25" max="2.0" step="0.05"
            value={layer.pitch}
            onChange={e => onUpdatePitch(layer.id, parseFloat(e.target.value))}
          />
        </div>

        <div className="control-group">
          <div className="control-label">
            <span className="control-label-name">Cloud</span>
            <span className="control-label-value">{transformPct}%</span>
          </div>
          <input
            type="range" min="0" max="1" step="0.05"
            value={layer.transform || 0}
            onChange={e => onUpdateTransform(layer.id, parseFloat(e.target.value))}
            title="Granular grain cloud modulation"
          />
        </div>

        <div className="layer-actions">
          <button className="btn-icon" onClick={handleSwap} disabled={swapping} title="Find acoustically similar sound (Acoustic Swap)">
            <RefreshCw size={14} className={swapping ? 'spin' : ''} />
          </button>
          <button className={`btn-icon ${layer.mute ? 'mute-active' : ''}`} onClick={() => onToggleMute(layer.id)} title="Mute layer">
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11 }}>M</span>
          </button>
          <button className={`btn-icon ${layer.solo ? 'solo-active' : ''}`} onClick={() => onToggleSolo(layer.id)} title="Solo layer">
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11 }}>S</span>
          </button>
          <button className="btn-icon" onClick={() => onRemoveLayer(layer.id)} title="Remove layer" style={{ color: 'var(--text-dim)' }}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Expanded EQ Panel */}
      {showEq && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--border-subtle)' }}>
          <InteractiveEQCanvas 
            trackPlayer={trackPlayer} 
            isPlaying={isPlaying} 
            eqParams={currentEqParams} 
            onEqChange={(idx, params) => onUpdateEq(layer.id, idx, params)} 
          />
        </div>
      )}
    </div>
  );
}
