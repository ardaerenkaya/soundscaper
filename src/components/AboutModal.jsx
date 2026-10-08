import React from 'react';
import { X, Cpu, Shield, Volume2 } from 'lucide-react';

export function AboutModal({ onClose }) {
  const boxStyle = {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: 14, borderRadius: 'var(--radius-md)',
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    marginBottom: 10,
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            🎧 About SoundScaper
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={boxStyle}>
          <Cpu size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: '#fff', display: 'block', marginBottom: 2 }}>Standalone — No Cloud Required</strong>
            Built-in NLP prompt parser decomposes natural language descriptions into sound layers without external AI APIs or subscriptions.
          </div>
        </div>

        <div style={boxStyle}>
          <Shield size={18} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: '#fff', display: 'block', marginBottom: 2 }}>Freesound CC0 1.0 Universal</strong>
            All audio clips are fetched from Freesound.org under Creative Commons 0 — free for commercial and personal use.
          </div>
        </div>

        <div style={boxStyle}>
          <Volume2 size={18} style={{ color: 'var(--yellow)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: '#fff', display: 'block', marginBottom: 2 }}>DAW Multi-Track Audio Engine</strong>
            Per-layer volume, pan, lowpass filter, pitch, grain-cloud transform, solo/mute, master reverb/compressor, live recording, and 16-bit WAV export.
          </div>
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', textAlign: 'right' }}>
          <button className="btn btn-primary" onClick={onClose} style={{ textTransform: 'none', fontSize: 12 }}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
