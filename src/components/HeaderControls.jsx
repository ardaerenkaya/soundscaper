import React from 'react';
import { Play, Square, Download, Circle, Info } from 'lucide-react';

export function HeaderControls({
  isPlaying,
  isRecording,
  isExporting,
  onPlay,
  onStop,
  onRecordToggle,
  onExport,
  onToggleAbout,
  hasLayers,
}) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand">
          <div className="brand-icon">🎧</div>
          <div className="brand-text">
            <h1>soundscaper<span>.cc0</span></h1>
            <p>Freesound CC0 Standalone Generator</p>
          </div>
        </div>

        <div className="transport">
          <div className="transport-group">
            <button
              className={`btn btn-play ${isPlaying ? 'active' : ''}`}
              onClick={onPlay}
              disabled={!hasLayers}
            >
              <Play size={12} style={isPlaying ? { fill: 'currentColor' } : {}} />
              {isPlaying ? 'Playing' : 'Play'}
            </button>
            <button className="btn btn-stop" onClick={onStop} disabled={!hasLayers || !isPlaying}>
              <Square size={12} style={{ fill: 'currentColor' }} /> Stop
            </button>
            <button
              className={`btn btn-record ${isRecording ? 'recording' : ''}`}
              onClick={onRecordToggle}
              disabled={!hasLayers}
              title="Record Master Audio + Sound Credits"
            >
              <Circle size={10} style={{ fill: 'currentColor', color: isRecording ? '#ef4444' : 'currentColor' }} />
              {isRecording ? 'Recording...' : 'Record'}
            </button>
            <button className="btn btn-export" onClick={onExport} disabled={!hasLayers || isExporting}>
              <Download size={12} /> {isExporting ? 'Exporting…' : 'WAV'}
            </button>
          </div>

          <button className="btn-icon" onClick={onToggleAbout} title="About">
            <Info size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
