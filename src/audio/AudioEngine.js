/**
 * AudioEngine — Master Web Audio context, routing & multi-track management
 *
 * Signal routing:
 * TrackPlayers → masterGain → [dry→compressor] + [reverbGain→convolver→compressor]
 *   → analyser → destination + [mediaStreamDest (Recording)]
 */

import { TrackPlayer } from './TrackPlayer.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressorNode = null;
    this.reverbNode = null;
    this.reverbGain = null;
    this.analyser = null;

    // Recording
    this.mediaStreamDest = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;

    this.tracks = new Map(); // layerId → TrackPlayer
    this.isPlaying = false;
    this.masterVolumeDb = -3;
    this.reverbLevel = 0;
    this.eventDensity = 1.0;

    this._prevVal = 0;
    this._energyHistory = [];
    this._integratedSum = 0;
    this._integratedCount = 0;
  }

  /** Lazy-init AudioContext (must be called from user gesture) */
  init() {
    if (this.ctx) return;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();

    // Compressor / limiter
    this.compressorNode = this.ctx.createDynamicsCompressor();
    this.compressorNode.threshold.setValueAtTime(-6, this.ctx.currentTime);
    this.compressorNode.knee.setValueAtTime(10, this.ctx.currentTime);
    this.compressorNode.ratio.setValueAtTime(8, this.ctx.currentTime);
    this.compressorNode.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressorNode.release.setValueAtTime(0.15, this.ctx.currentTime);

    // Master gain
    this.masterGain = this.ctx.createGain();
    this._applyMasterGain();

    // Analyser
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.75;

    // Reverb send (wet path)
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.setValueAtTime(this.reverbLevel, this.ctx.currentTime);
    this.reverbNode = this.ctx.createConvolver();
    this._createImpulse();

    // Destination node for live recording
    this.mediaStreamDest = this.ctx.createMediaStreamDestination();

    // Routing
    this.masterGain.connect(this.compressorNode);         // dry path
    this.masterGain.connect(this.reverbGain);              // wet send
    this.reverbGain.connect(this.reverbNode);
    this.reverbNode.connect(this.compressorNode);          // wet → compressor
    this.compressorNode.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.compressorNode.connect(this.mediaStreamDest);
  }

  _createImpulse() {
    const sr = this.ctx.sampleRate;
    const len = sr * 2; // 2s tail
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
      }
    }
    this.reverbNode.buffer = buf;
  }

  ensureRunning() {
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  // ---- Recording & Credits Export ----

  startRecording() {
    this.ensureRunning();
    if (this.isRecording) return;

    this.recordedChunks = [];
    try {
      const stream = this.mediaStreamDest.stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });

      this.mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) this.recordedChunks.push(e.data);
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
    }
  }

  stopRecording() {
    return new Promise((resolve) => {
      if (!this.isRecording || !this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType || 'audio/webm' });
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  // ---- Track management ----

  async addTrack(layerConfig, previewUrl) {
    this.ensureRunning();

    if (this.tracks.has(layerConfig.id)) {
      this.removeTrack(layerConfig.id);
    }

    const player = new TrackPlayer(this.ctx, this.masterGain, layerConfig);
    this.tracks.set(layerConfig.id, player);

    if (previewUrl) {
      const ok = await player.loadAudio(previewUrl);
      if (ok && this.isPlaying) {
        player.play(this.eventDensity);
      }
    }

    this._syncSoloMute();
    return player;
  }

  removeTrack(id) {
    const p = this.tracks.get(id);
    if (p) { p.dispose(); this.tracks.delete(id); }
    this._syncSoloMute();
  }

  getTrack(id) {
    return this.tracks.get(id);
  }

  // ---- Transport ----

  playAll() {
    this.ensureRunning();
    this.isPlaying = true;
    for (const p of this.tracks.values()) {
      if (!p.isPlaying && p.audioBuffer) p.play(this.eventDensity);
    }
  }

  stopAll() {
    this.isPlaying = false;
    for (const p of this.tracks.values()) p.stop();
  }

  // ---- Master controls ----

  setMasterVolume(db) {
    this.masterVolumeDb = db;
    this._applyMasterGain();
  }

  _applyMasterGain() {
    if (!this.masterGain || !this.ctx) return;
    const lin = Math.pow(10, this.masterVolumeDb / 20);
    this.masterGain.gain.setTargetAtTime(lin, this.ctx.currentTime, 0.02);
  }

  setReverb(level) {
    this.reverbLevel = Math.max(0, Math.min(1, level));
    if (this.reverbGain && this.ctx) {
      this.reverbGain.gain.setTargetAtTime(this.reverbLevel, this.ctx.currentTime, 0.02);
    }
  }

  setEventDensity(d) {
    this.eventDensity = d;
    if (this.isPlaying) {
      for (const p of this.tracks.values()) {
        if (p.config.isEvent && p.isPlaying) {
          p.stop();
          p.play(this.eventDensity);
        }
      }
    }
  }

  // ---- Per-track controls ----

  setTrackVolume(id, db) { this.tracks.get(id)?.setVolume(db); }
  setTrackPan(id, v) { this.tracks.get(id)?.setPan(v); }
  setTrackPitch(id, p) { this.tracks.get(id)?.setPitch(p); }
  setTrackTransform(id, t) { this.tracks.get(id)?.setTransform(t); }
  setTrackEq(id, index, params) { this.tracks.get(id)?.setEqBand(index, params); }

  toggleMute(id) {
    const p = this.tracks.get(id);
    if (!p) return false;
    p.setMute(!p.isMuted);
    return p.isMuted;
  }

  toggleSolo(id) {
    const p = this.tracks.get(id);
    if (!p) return false;
    p.setSolo(!p.isSoloed);
    this._syncSoloMute();
    return p.isSoloed;
  }

  _syncSoloMute() {
    const anySoloed = [...this.tracks.values()].some(p => p.isSoloed);
    for (const p of this.tracks.values()) {
      p.setSuppressedBySolo(anySoloed && !p.isSoloed);
    }
  }

  // ---- Analyser data ----

  getFrequencyData() {
    if (!this.analyser) return new Uint8Array(0);
    const buf = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(buf);
    return buf;
  }

  getMeterData() {
    if (!this.analyser) return { peak: -100, rms: -100, lufsM: -100, lufsS: -100, lufsI: -100 };
    const data = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(data);
    
    let sumSquares = 0;
    let peak = 0;
    let lufsSum = 0;
    
    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      const abs = Math.abs(val);
      if (abs > peak) peak = abs;
      sumSquares += val * val;
      
      // Simple high-pass pre-filter for K-weighting approximation
      const diff = val - this._prevVal * 0.5;
      lufsSum += diff * diff;
      this._prevVal = val;
    }
    
    // Accumulate for rolling windows
    const energy = lufsSum / data.length;
    this._energyHistory.push(energy);
    if (this._energyHistory.length > 200) this._energyHistory.shift(); // ~3 seconds at 60fps
    
    // Momentary (last ~400ms = ~25 frames)
    const mFrames = Math.min(this._energyHistory.length, 25);
    let mEnergy = 0;
    for (let i = this._energyHistory.length - mFrames; i < this._energyHistory.length; i++) mEnergy += this._energyHistory[i];
    mEnergy /= mFrames;

    // Short-Term (last ~3s = ~180 frames)
    let sEnergy = 0;
    for (let i = 0; i < this._energyHistory.length; i++) sEnergy += this._energyHistory[i];
    sEnergy /= this._energyHistory.length;

    // Integrated
    if (this.isPlaying) {
       this._integratedSum += energy;
       this._integratedCount++;
    }
    const iEnergy = this._integratedCount > 0 ? this._integratedSum / this._integratedCount : 0;
    
    const rms = Math.sqrt(sumSquares / data.length);
    
    const peakDb = peak > 0 ? 20 * Math.log10(peak) : -100;
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -100;
    
    const calcLufs = (e) => e > 0 ? (10 * Math.log10(e)) - 0.7 : -100;
    
    return { 
      peak: peakDb, 
      rms: rmsDb, 
      lufsM: calcLufs(mEnergy),
      lufsS: calcLufs(sEnergy),
      lufsI: calcLufs(iEnergy)
    };
  }

  resetIntegratedLoudness() {
    this._integratedSum = 0;
    this._integratedCount = 0;
    this._energyHistory = [];
  }

  // ---- Cleanup ----

  clearAll() {
    this.stopAll();
    for (const p of this.tracks.values()) p.dispose();
    this.tracks.clear();
  }
}
