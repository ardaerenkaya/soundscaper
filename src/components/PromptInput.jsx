import React from 'react';
import { Wand2, RefreshCw, Trash2, Shuffle } from 'lucide-react';

export function PromptInput({
  prompt, setPrompt,
  onCompose, onClear, onRandomScene,
  isComposing,
  layers = [], loadedCount = 0,
}) {
  const hasLayers = layers.length > 0;
  const allLoaded = hasLayers && loadedCount === layers.length;

  return (
    <section className="prompt-section panel" style={{ padding: 20 }}>
      <textarea
        className="prompt-textarea"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder='Describe your scene… e.g. "heavy rain, walking on grass, man coughing"'
        rows={2}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isComposing && prompt.trim()) onCompose();
          }
        }}
      />

      <div className="prompt-bar">
        {/* Status */}
        <div className="prompt-status">
          <span className={`led ${
            isComposing ? 'led-amber' :
            allLoaded ? 'led-green' :
            hasLayers ? 'led-cyan' :
            'led-off'
          }`} />
          <span>
            {isComposing
              ? <span style={{ color: 'var(--yellow)' }}>Searching…</span>
              : hasLayers
                ? <>ready — <strong style={{ color: '#fff' }}>{loadedCount}</strong> / {layers.length} layers</>
                : <span style={{ color: 'var(--text-dim)' }}>Enter a scene description</span>
            }
          </span>
        </div>

        {/* Actions */}
        <div className="prompt-actions">
          {hasLayers && (
            <button className="btn btn-ghost" onClick={onClear}>
              <Trash2 size={14} /> Clear
            </button>
          )}

          <button className="btn btn-ghost" onClick={onRandomScene}>
            <Shuffle size={14} /> Random
          </button>

          <button
            className="btn btn-primary"
            onClick={() => onCompose()}
            disabled={isComposing || !prompt.trim()}
          >
            {isComposing
              ? <><RefreshCw size={14} className="spin" /> Processing…</>
              : <><Wand2 size={14} /> Compose Soundscape</>
            }
          </button>
        </div>
      </div>
    </section>
  );
}
