export class TrackPlayer {
  constructor(audioContext, masterDestination, layerConfig) {
    this.ctx = audioContext;
    this.masterDest = masterDestination;
    this.config = { ...layerConfig };

    this.audioBuffer = null;
    this.sourceNode = null;
    this.eqNodes = [];
    this.gainNode = null;
    this.pannerNode = null;
    this.analyserNode = null;

    this.isPlaying = false;
    this.isLoading = false;
    this.isMuted = false;
    this.isSoloed = false;
    this._isSuppressedBySolo = false;

    this.volumeDb = layerConfig.vol ?? -6;
    this.panVal = layerConfig.pan ?? 0;
    this.pitchVal = layerConfig.pitch ?? 1.0;
    this.transformVal = layerConfig.transform ?? 0;

    this.startedAt = 0;
    this.playbackOffset = 0;

    this._eventTimers = [];
    this._grainTimer = null;

    this._buildNodeGraph();
  }

  _buildNodeGraph() {
    // 5-Band Parametric EQ
    const defaultEq = this.config.eqBands || [
      { type: 'highpass', freq: 20, gain: 0, Q: 0.7 },
      { type: 'lowshelf', freq: 100, gain: 0, Q: 0.7 },
      { type: 'peaking', freq: 1000, gain: 0, Q: 1.0 },
      { type: 'highshelf', freq: 5000, gain: 0, Q: 0.7 },
      { type: 'lowpass', freq: 20000, gain: 0, Q: 0.7 }
    ];

    this.eqNodes = defaultEq.map(band => {
      const node = this.ctx.createBiquadFilter();
      node.type = band.type;
      node.frequency.value = band.freq;
      node.gain.value = band.gain;
      node.Q.value = band.Q;
      return node;
    });

    for (let i = 0; i < this.eqNodes.length - 1; i++) {
      this.eqNodes[i].connect(this.eqNodes[i+1]);
    }

    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);

    this.pannerNode = this.ctx.createStereoPanner();
    this.pannerNode.pan.setValueAtTime(this.panVal, this.ctx.currentTime);

    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 2048; 
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Route: EQ -> Gain -> Panner -> Analyser -> Master
    this.eqNodes[this.eqNodes.length - 1].connect(this.gainNode);
    this.gainNode.connect(this.pannerNode);
    this.pannerNode.connect(this.analyserNode);
    this.analyserNode.connect(this.masterDest);
  }

  async loadAudio(url) {
    if (!url) return false;
    this.isLoading = true;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const arrayBuffer = await resp.arrayBuffer();
      this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.isLoading = false;
      return true;
    } catch (err) {
      console.error(`[TrackPlayer] Load failed for "${this.config.title}":`, err);
      this.isLoading = false;
      return false;
    }
  }

  play(densityFactor = 1.0, offset = 0) {
    if (!this.audioBuffer || this.isPlaying) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.isPlaying = true;
    this.playbackOffset = offset;
    this.startedAt = this.ctx.currentTime - offset;
    this._applyGain();

    if (this.config.isEvent) {
      this._startEventScheduler(densityFactor, offset);
    } else {
      this._startLooping(offset);
    }

    if (this.transformVal > 0) {
      this._startGranularModulation();
    }
  }

  seek(offset) {
    if (!this.audioBuffer) return;
    const wasPlaying = this.isPlaying;
    
    // Hard stop immediately to prevent delayed stop of new source
    this.isPlaying = false;
    this._eventTimers.forEach(t => clearTimeout(t));
    this._eventTimers = [];
    if (this._grainTimer) {
      clearInterval(this._grainTimer);
      this._grainTimer = null;
    }
    const t = this.ctx.currentTime;
    this.gainNode.gain.cancelScheduledValues(t);
    this._stopSource();

    if (wasPlaying) {
       this.play(this.config.density || 1.0, offset);
    } else {
       this.playbackOffset = offset;
       this.startedAt = this.ctx.currentTime - offset;
    }
  }

  _startLooping(offset = 0) {
    this._stopSource();
    const src = this.ctx.createBufferSource();
    src.buffer = this.audioBuffer;
    src.loop = true;
    src.playbackRate.setValueAtTime(this.pitchVal, this.ctx.currentTime);
    src.connect(this.eqNodes[0]);
    src.start(0, offset);
    this.sourceNode = src;

    src.onended = () => {
      if (this.isPlaying && this.sourceNode === src) {
        // If it naturally ends (not stopped manually), restart from 0
        this.startedAt = this.ctx.currentTime;
        this._startLooping(0);
      }
    };
  }

  _startEventScheduler(densityFactor = 1.0, initialOffset = 0) {
    this._triggerOneShot(initialOffset);
    const schedule = () => {
      if (!this.isPlaying) return;
      const baseDelay = 2500 + Math.random() * 7000;
      const delay = baseDelay / Math.max(0.15, densityFactor);
      const timer = setTimeout(() => {
        if (this.isPlaying) {
          this._triggerOneShot();
          schedule();
        }
      }, delay);
      this._eventTimers.push(timer);
    };
    schedule();
  }

  _triggerOneShot(offset = 0) {
    if (!this.audioBuffer) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.audioBuffer;
      const jitter = 0.96 + Math.random() * 0.08;
      src.playbackRate.setValueAtTime(this.pitchVal * jitter, this.ctx.currentTime);
      src.connect(this.eqNodes[0]);
      src.start(0, offset);
    } catch (e) { /* ignore */ }
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    this._eventTimers.forEach(t => clearTimeout(t));
    this._eventTimers = [];

    if (this._grainTimer) {
      clearInterval(this._grainTimer);
      this._grainTimer = null;
    }

    const t = this.ctx.currentTime;
    this.gainNode.gain.cancelScheduledValues(t);
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, t);
    this.gainNode.gain.linearRampToValueAtTime(0, t + 0.05);

    setTimeout(() => this._stopSource(), 60);
  }

  _stopSource() {
    if (this.sourceNode) {
      try { this.sourceNode.onended = null; } catch (e) {}
      try { this.sourceNode.stop(); } catch (e) {}
      try { this.sourceNode.disconnect(); } catch (e) {}
      this.sourceNode = null;
    }
  }

  _startGranularModulation() {
    if (this._grainTimer) clearInterval(this._grainTimer);
    this._grainTimer = setInterval(() => {
      if (!this.isPlaying || this.transformVal <= 0) return;
      if (this.sourceNode?.playbackRate) {
        const jitter = (Math.random() - 0.5) * this.transformVal * 0.4;
        const p = Math.max(0.2, Math.min(2.5, this.pitchVal + jitter));
        this.sourceNode.playbackRate.setTargetAtTime(p, this.ctx.currentTime, 0.05);
      }
    }, 250);
  }

  getFrequencyData(array) {
    if (this.analyserNode && this.isPlaying && !this.isMuted && !this._isSuppressedBySolo) {
      this.analyserNode.getByteFrequencyData(array);
    } else {
      array.fill(0);
    }
  }

  getMeterData() {
    if (!this.analyserNode || !this.isPlaying || this.isMuted || this._isSuppressedBySolo) {
      return { peak: -100, rms: -100 };
    }
    const data = new Float32Array(this.analyserNode.fftSize);
    this.analyserNode.getFloatTimeDomainData(data);
    
    let sumSquares = 0;
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      const abs = Math.abs(val);
      if (abs > peak) peak = abs;
      sumSquares += val * val;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    
    const peakDb = peak > 0 ? 20 * Math.log10(peak) : -100;
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -100;
    
    return { peak: peakDb, rms: rmsDb };
  }

  // ---- Parameter setters ----
  setVolume(db) {
    this.volumeDb = db;
    this._applyGain();
  }

  setMute(m) {
    this.isMuted = m;
    this._applyGain();
  }

  setSolo(s) {
    this.isSoloed = s;
  }

  setSuppressedBySolo(suppressed) {
    this._isSuppressedBySolo = suppressed;
    this._applyGain();
  }

  _applyGain() {
    if (!this.gainNode || !this.ctx) return;
    const t = this.ctx.currentTime;
    const target = (this.isMuted || this._isSuppressedBySolo)
      ? 0
      : Math.pow(10, this.volumeDb / 20);
    this.gainNode.gain.setTargetAtTime(target, t, 0.025);
  }

  setPan(v) {
    this.panVal = Math.max(-1, Math.min(1, v));
    this.pannerNode.pan.setTargetAtTime(this.panVal, this.ctx.currentTime, 0.025);
  }

  setEqBand(index, { type, freq, gain, Q }) {
    if (!this.eqNodes[index]) return;
    const node = this.eqNodes[index];
    if (type) node.type = type;
    if (freq !== undefined) node.frequency.setTargetAtTime(Math.max(20, Math.min(20000, freq)), this.ctx.currentTime, 0.05);
    if (gain !== undefined) node.gain.setTargetAtTime(Math.max(-24, Math.min(24, gain)), this.ctx.currentTime, 0.05);
    if (Q !== undefined) node.Q.setTargetAtTime(Math.max(0.1, Math.min(10, Q)), this.ctx.currentTime, 0.05);
  }

  getEqResponse(frequencies, magResponse, phaseResponse) {
    // Combine frequency responses of all EQ nodes
    // magResponse initially should be filled with 1.0 (0dB)
    for (let i = 0; i < magResponse.length; i++) magResponse[i] = 1.0;
    
    const tempMag = new Float32Array(frequencies.length);
    const tempPhase = new Float32Array(frequencies.length);

    for (const node of this.eqNodes) {
      node.getFrequencyResponse(frequencies, tempMag, tempPhase);
      for (let i = 0; i < frequencies.length; i++) {
        magResponse[i] *= tempMag[i];
      }
    }
  }

  setPitch(p) {
    this.pitchVal = Math.max(0.25, Math.min(2.0, p));
    if (this.sourceNode?.playbackRate) {
      this.sourceNode.playbackRate.setTargetAtTime(this.pitchVal, this.ctx.currentTime, 0.025);
    }
  }

  setTransform(tVal) {
    this.transformVal = Math.max(0, Math.min(1, tVal));
    if (this.transformVal > 0 && this.isPlaying && !this._grainTimer) {
      this._startGranularModulation();
    } else if (this.transformVal === 0 && this._grainTimer) {
      clearInterval(this._grainTimer);
      this._grainTimer = null;
      if (this.sourceNode?.playbackRate) {
        this.sourceNode.playbackRate.setTargetAtTime(this.pitchVal, this.ctx.currentTime, 0.1);
      }
    }
  }

  dispose() {
    this.stop();
    this.eqNodes.forEach(n => { try { n.disconnect(); } catch (e) {} });
    try { this.gainNode.disconnect(); } catch (e) {}
    try { this.pannerNode.disconnect(); } catch (e) {}
    try { this.analyserNode.disconnect(); } catch (e) {}
  }
}
