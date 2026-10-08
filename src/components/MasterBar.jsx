import React, { useEffect, useRef, useState } from 'react';
import { VisualizerCanvas } from './VisualizerCanvas';


export function MasterBar({
  audioEngine, isPlaying,
  masterVolDb, onChangeMasterVol,
  reverbLevel, onChangeReverb,
  eventDensity, onChangeEventDensity,
}) {
  const densityLabel =
    eventDensity < 0.6 ? 'rare' :
    eventDensity > 1.4 ? 'dense' : 'moderate';

  return (
    <div className="panel master-bar">
      <div className="master-bar-inner">
        {/* Spectrum */}
        <div className="master-visualizer">
          <div className="master-visualizer-label">Spectrum</div>
          <VisualizerCanvas audioEngine={audioEngine} isPlaying={isPlaying} />
        </div>

        {/* Controls */}
        <div className="master-controls">
          <div className="master-knob">
            <div className="master-knob-header">
              <span className="master-knob-label">Event Density</span>
              <span className="master-knob-value val-cyan">{densityLabel}</span>
            </div>
            <input
              type="range" min="0.2" max="2.0" step="0.1"
              value={eventDensity}
              onChange={e => onChangeEventDensity(parseFloat(e.target.value))}
            />
          </div>

          <div className="master-knob">
            <div className="master-knob-header">
              <span className="master-knob-label">Master Volume</span>
              <span className="master-knob-value val-emerald">{masterVolDb.toFixed(1)} dB</span>
            </div>
            <input
              type="range" min="-36" max="6" step="0.5"
              value={masterVolDb}
              onChange={e => onChangeMasterVol(parseFloat(e.target.value))}
            />
          </div>

          <div className="master-knob">
            <div className="master-knob-header">
              <span className="master-knob-label">Reverb</span>
              <span className="master-knob-value val-amber">{reverbLevel.toFixed(2)}</span>
            </div>
            <input
              type="range" min="0" max="1" step="0.05"
              value={reverbLevel}
              onChange={e => onChangeReverb(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
