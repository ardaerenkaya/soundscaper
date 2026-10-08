import React, { useState, useEffect, useRef } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import { FreesoundProvider } from './services/FreesoundProvider';
import { parseSoundscapePrompt } from './services/promptParser';
import { exportSoundscapeToWav } from './services/audioExporter';

import { HeaderControls } from './components/HeaderControls';
import { PromptInput } from './components/PromptInput';
import { MasterBar } from './components/MasterBar';
import { AdvancedMeter } from './components/AdvancedMeter';
import { LayerCard } from './components/LayerCard';
import { AboutModal } from './components/AboutModal';
import { Plus, Layers, Sparkles } from 'lucide-react';

export default function App() {
  const engineRef = useRef(null);
  const providerRef = useRef(null);
  const composingRef = useRef(false);

  const [prompt, setPrompt] = useState('');
  const [layers, setLayers] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const [masterVolDb, setMasterVolDb] = useState(-3);
  const [reverbLevel, setReverbLevel] = useState(0);
  const [eventDensity, setEventDensity] = useState(1.0);

  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    engineRef.current = new AudioEngine();
    providerRef.current = new FreesoundProvider();
    return () => { engineRef.current?.clearAll(); };
  }, []);

  const loadedCount = layers.filter(l => !l.isLoading && l.soundDetails?.previewUrl).length;

  /* ========================
     COMPOSE — Main Workflow (Ultra-Fast Parallel Execution)
     ======================== */
  async function doCompose(inputText) {
    const text = (inputText || prompt || '').trim();
    if (!text || composingRef.current) return;

    composingRef.current = true;
    setIsComposing(true);

    const engine = engineRef.current;
    engine.ensureRunning();
    engine.clearAll();
    setIsPlaying(false);

    // 1. Parse prompt into precise layers
    const parsed = parseSoundscapePrompt(text);
    if (parsed.length === 0) {
      composingRef.current = false;
      setIsComposing(false);
      return;
    }

    // Set initial loading state in UI
    const loadingLayers = parsed.map(l => ({
      ...l, isLoading: true, soundDetails: null, alternatives: [], altIndex: 0,
    }));
    setLayers(loadingLayers);

    // 2. Perform parallel searches on Freesound (BLAZING FAST)
    const provider = providerRef.current;
    const searchPromises = loadingLayers.map(layer =>
      provider.search(layer.searchKeywords, { maxResults: 6 })
        .then(sounds => ({ layer, sounds }))
        .catch(() => ({ layer, sounds: [] }))
    );

    const searchResults = await Promise.all(searchPromises);

    // 3. Load audio streams into Web Audio Engine in parallel
    const finalLayers = [];
    const loadAudioPromises = searchResults.map(async ({ layer, sounds }) => {
      if (sounds && sounds.length > 0 && sounds[0].previewUrl) {
        await engine.addTrack(layer, sounds[0].previewUrl);
        return {
          ...layer,
          isLoading: false,
          soundDetails: sounds[0],
          alternatives: sounds,
          altIndex: 0,
        };
      } else {
        return { ...layer, isLoading: false, soundDetails: null };
      }
    });

    const resolvedLayers = await Promise.all(loadAudioPromises);

    setLayers(resolvedLayers);
    composingRef.current = false;
    setIsComposing(false);

    // Auto play once loaded
    if (resolvedLayers.some(l => l.soundDetails?.previewUrl)) {
      engine.playAll();
      setIsPlaying(true);
    }
  }

  /* ========================
     TRANSPORT & RECORDING
     ======================== */
  function handlePlay() {
    engineRef.current?.playAll();
    setIsPlaying(true);
  }

  function handleStop() {
    engineRef.current?.stopAll();
    setIsPlaying(false);
  }

  async function handleRecordToggle() {
    const engine = engineRef.current;
    if (!engine) return;

    if (!isRecording) {
      engine.startRecording();
      setIsRecording(true);
      if (!isPlaying) {
        engine.playAll();
        setIsPlaying(true);
      }
    } else {
      const audioBlob = await engine.stopRecording();
      setIsRecording(false);

      if (audioBlob) {
        // 1. Download Recorded Audio
        const audioUrl = URL.createObjectURL(audioBlob);
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = `soundscape_recording_${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(audioUrl);

        // 2. Download Credits Text File
        downloadCreditsFile();
      }
    }
  }

  function downloadCreditsFile() {
    let text = `SOUNDSCAPER CC0 SOUND CREDITS\n`;
    text += `=============================\n`;
    text += `Scene Prompt: "${prompt}"\n`;
    text += `Generated At: ${new Date().toLocaleString()}\n\n`;
    text += `ACTIVE SOUND LAYERS & AUTHORS:\n\n`;

    layers.forEach((layer, i) => {
      text += `${i + 1}. [${layer.category.toUpperCase()}] ${layer.title}\n`;
      if (layer.soundDetails) {
        text += `   - Sound Title: ${layer.soundDetails.title}\n`;
        text += `   - Author: ${layer.soundDetails.author}\n`;
        text += `   - Provider: ${layer.soundDetails.source || 'Unknown'}\n`;
        text += `   - URL: ${layer.soundDetails.url || layer.soundDetails.freesoundUrl}\n`;
        text += `   - License: ${layer.soundDetails.license}\n`;
      } else {
        text += `   - No sound preview available\n`;
      }
      text += `\n`;
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const creditsUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = creditsUrl;
    a.download = `soundscape_credits_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(creditsUrl);
  }

  async function handleExport() {
    if (!engineRef.current || isExporting) return;
    setIsExporting(true);
    try {
      await exportSoundscapeToWav(engineRef.current.tracks, masterVolDb, 30);
      downloadCreditsFile();
    } catch (err) { console.error('Export failed:', err); }
    setIsExporting(false);
  }

  function handleClear() {
    engineRef.current?.clearAll();
    setLayers([]);
    setIsPlaying(false);
  }

  function handleRandomScene() {
    const scenes = [
      'hospital room tone ambience',
      'a laundromat at one in the morning, a machine stops and someone coughs',
      'rainy day walking on wet grass man coughing',
      'cozy cafe, coffee machine, soft chatter, rain outside',
      'subway station, approaching train, footsteps on concrete, dripping water',
      'campfire in forest, crickets at night, wind in trees',
    ];
    setPrompt(scenes[Math.floor(Math.random() * scenes.length)]);
  }

  /* ========================
     MASTER CONTROLS
     ======================== */
  function changeMasterVol(v) {
    setMasterVolDb(v);
    engineRef.current?.setMasterVolume(v);
  }

  function changeReverb(v) {
    setReverbLevel(v);
    engineRef.current?.setReverb(v);
  }

  function changeDensity(v) {
    setEventDensity(v);
    engineRef.current?.setEventDensity(v);
  }

  /* ========================
     LAYER CONTROLS
     ======================== */
  function updateVol(id, v) {
    setLayers(p => p.map(l => l.id === id ? { ...l, vol: v } : l));
    engineRef.current?.setTrackVolume(id, v);
  }

  function updatePan(id, v) {
    setLayers(p => p.map(l => l.id === id ? { ...l, pan: v } : l));
    engineRef.current?.setTrackPan(id, v);
  }

  function updateEq(id, index, params) {
    setLayers(p => p.map(l => {
      if (l.id !== id) return l;
      const newEq = l.eqBands ? [...l.eqBands] : [
        { type: 'highpass', freq: 20, gain: 0, Q: 0.7 },
        { type: 'lowshelf', freq: 100, gain: 0, Q: 0.7 },
        { type: 'peaking', freq: 1000, gain: 0, Q: 1.0 },
        { type: 'highshelf', freq: 5000, gain: 0, Q: 0.7 },
        { type: 'lowpass', freq: 20000, gain: 0, Q: 0.7 }
      ];
      newEq[index] = { ...newEq[index], ...params };
      return { ...l, eqBands: newEq };
    }));
    engineRef.current?.setTrackEq(id, index, params);
  }

  function updatePitch(id, v) {
    setLayers(p => p.map(l => l.id === id ? { ...l, pitch: v } : l));
    engineRef.current?.setTrackPitch(id, v);
  }

  function updateTransform(id, v) {
    setLayers(p => p.map(l => l.id === id ? { ...l, transform: v } : l));
    engineRef.current?.setTrackTransform(id, v);
  }

  function toggleMute(id) {
    const muted = engineRef.current?.toggleMute(id);
    setLayers(p => p.map(l => l.id === id ? { ...l, mute: muted } : l));
  }

  function toggleSolo(id) {
    const soloed = engineRef.current?.toggleSolo(id);
    setLayers(p => p.map(l => l.id === id ? { ...l, solo: soloed } : l));
  }

  function removeLayer(id) {
    engineRef.current?.removeTrack(id);
    setLayers(p => p.filter(l => l.id !== id));
  }

  async function swapSound(id) {
    const targetLayer = layers.find(l => l.id === id);
    if (!targetLayer) return;

    let nextIndex = (targetLayer.altIndex + 1) % (targetLayer.alternatives.length || 1);
    let nextSound = targetLayer.alternatives[nextIndex];

    // Fetch fresh acoustic similar sounds if alternatives exhausted
    if (!nextSound || targetLayer.alternatives.length <= 1) {
      if (targetLayer.soundDetails?.id) {
        const similar = await providerRef.current.getSimilar(targetLayer.soundDetails.id, { maxResults: 6 });
        if (similar.length > 0) {
          targetLayer.alternatives = similar;
          nextIndex = 0;
          nextSound = similar[0];
        }
      }
      
      // Fallback to text search if similar fails
      if (!nextSound) {
        const fresh = await providerRef.current.search(targetLayer.searchKeywords, { maxResults: 8 });
        if (fresh.length > 0) {
          nextSound = fresh[Math.floor(Math.random() * fresh.length)];
        }
      }
    }

    if (nextSound?.previewUrl) {
      await engineRef.current?.addTrack(targetLayer, nextSound.previewUrl);
      setLayers(prev => prev.map(l => l.id === id ? {
        ...l,
        soundDetails: nextSound,
        altIndex: nextIndex,
      } : l));
    }
  }

  function addManualLayer() {
    const newL = {
      id: `layer_${Date.now()}`,
      category: 'field',
      title: 'Custom Sound Layer',
      query: 'ambient tone',
      searchKeywords: 'ambient tone',
      vol: -6, pan: 0, pitch: 1.0, transform: 0,
      eqBands: [
        { type: 'highpass', freq: 20, gain: 0, Q: 0.7 },
        { type: 'lowshelf', freq: 100, gain: 0, Q: 0.7 },
        { type: 'peaking', freq: 1000, gain: 0, Q: 1.0 },
        { type: 'highshelf', freq: 5000, gain: 0, Q: 0.7 },
        { type: 'lowpass', freq: 20000, gain: 0, Q: 0.7 }
      ],
      isEvent: false, mute: false, solo: false,
      isLoading: true, soundDetails: null, alternatives: [], altIndex: 0,
    };
    setLayers(p => [...p, newL]);

    providerRef.current.search('ambient tone', { maxResults: 6 }).then(async sounds => {
      if (sounds.length > 0) {
        await engineRef.current?.addTrack(newL, sounds[0].previewUrl);
        setLayers(p => p.map(l => l.id === newL.id ? {
          ...l, isLoading: false, soundDetails: sounds[0], alternatives: sounds,
        } : l));
      } else {
        setLayers(p => p.map(l => l.id === newL.id ? { ...l, isLoading: false } : l));
      }
    });
  }

  return (
    <div className="app-layout">
      <HeaderControls
        isPlaying={isPlaying}
        isRecording={isRecording}
        isExporting={isExporting}
        onPlay={handlePlay}
        onStop={handleStop}
        onRecordToggle={handleRecordToggle}
        onExport={handleExport}
        onToggleAbout={() => setShowAbout(true)}
        hasLayers={layers.length > 0}
      />

      <main className="main-content">
        <PromptInput
          prompt={prompt}
          setPrompt={setPrompt}
          isComposing={isComposing}
          onCompose={doCompose}
          onClear={handleClear}
          onRandomScene={handleRandomScene}
          layers={layers}
          loadedCount={loadedCount}
        />

        {layers.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <MasterBar
                audioEngine={engineRef.current}
                isPlaying={isPlaying}
                masterVolDb={masterVolDb}
                onChangeMasterVol={changeMasterVol}
                reverbLevel={reverbLevel}
                onChangeReverb={changeReverb}
                eventDensity={eventDensity}
                onChangeEventDensity={changeDensity}
              />
            </div>
            <AdvancedMeter 
              audioEngine={engineRef.current}
              isPlaying={isPlaying}
            />
          </div>
        )}

        {/* Layers Section */}
        <section className="layers-section">
          <div className="layers-header">
            <div className="layers-title">
              <Layers size={14} style={{ color: 'var(--accent)' }} />
              <h2>Sound Layers ({loadedCount}/{layers.length} ready)</h2>
            </div>
            {layers.length > 0 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost" onClick={addManualLayer}>
                  <Plus size={12} /> Add Layer
                </button>
                <button className="btn btn-ghost" onClick={handleClear} style={{ color: 'var(--red)' }}>
                  Clear All
                </button>
              </div>
            )}
          </div>

          {layers.length === 0 && !isComposing && (
            <div className="empty-state">
              <Sparkles size={28} style={{ color: 'var(--accent)', opacity: 0.6, marginBottom: 12 }} />
              <h3>Create Your Soundscape</h3>
              <p>Type a natural language scene description above (e.g. <em>"hospital room tone"</em> or <em>"laundromat at night with coughing"</em>) and click <strong>Compose Soundscape</strong>.</p>
            </div>
          )}

          <div className="layer-list">
            {layers.map(layer => (
              <LayerCard
                key={layer.id}
                layer={layer}
                trackPlayer={engineRef.current?.getTrack(layer.id)}
                isPlaying={isPlaying}
                onUpdateVol={updateVol}
                onUpdatePan={updatePan}
                onUpdateEq={updateEq}
                onUpdatePitch={updatePitch}
                onUpdateTransform={updateTransform}
                onToggleMute={toggleMute}
                onToggleSolo={toggleSolo}
                onRemoveLayer={removeLayer}
                onSwapSound={swapSound}
              />
            ))}
          </div>
        </section>
      </main>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}
