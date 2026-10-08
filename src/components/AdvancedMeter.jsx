import React, { useEffect, useRef, useState } from 'react';

export function AdvancedMeter({ audioEngine, isPlaying }) {
  const [meter, setMeter] = useState({ peak: -100, rms: -100, lufsM: -100, lufsS: -100, lufsI: -100 });
  const [maxVals, setMaxVals] = useState({ lufsM: -100, lufsS: -100, peak: -100 });
  const rafRef = useRef(null);

  useEffect(() => {
    const updateMeter = () => {
      if (audioEngine && isPlaying) {
        const data = audioEngine.getMeterData();
        
        setMeter(prev => ({
          peak: prev.peak + (data.peak - prev.peak) * 0.4,
          rms: prev.rms + (data.rms - prev.rms) * 0.2,
          lufsM: prev.lufsM + (data.lufsM - prev.lufsM) * 0.15,
          lufsS: prev.lufsS + (data.lufsS - prev.lufsS) * 0.05,
          lufsI: data.lufsI
        }));

        setMaxVals(prev => ({
          lufsM: Math.max(prev.lufsM, data.lufsM),
          lufsS: Math.max(prev.lufsS, data.lufsS),
          peak: Math.max(prev.peak, data.peak)
        }));
      } else {
        setMeter(prev => ({
          peak: Math.max(-100, prev.peak - 2),
          rms: Math.max(-100, prev.rms - 1),
          lufsM: Math.max(-100, prev.lufsM - 0.5),
          lufsS: Math.max(-100, prev.lufsS - 0.2),
          lufsI: prev.lufsI
        }));
      }
      rafRef.current = requestAnimationFrame(updateMeter);
    };
    updateMeter();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [audioEngine, isPlaying]);

  const handleReset = () => {
    if (audioEngine) audioEngine.resetIntegratedLoudness();
    setMeter(prev => ({ ...prev, lufsI: -100 }));
    setMaxVals({ lufsM: -100, lufsS: -100, peak: -100 });
  };

  const pct = (db) => Math.max(0, Math.min(100, (db + 60) * (100 / 60)));
  const formatDb = (val) => val <= -90 ? '-∞' : val.toFixed(1);

  return (
    <div className="panel advanced-meter" onClick={handleReset} style={{ 
      display: 'flex', width: 260, height: '100%', padding: '16px', gap: '20px', 
      background: '#191e24', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif'
    }} title="Click to reset LUFS">
      
      {/* Left Column: LUFS Bar */}
      <div style={{ display: 'flex', gap: '8px', height: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '10px', color: '#88919e', textAlign: 'right', paddingTop: '4px', paddingBottom: '20px' }}>
          <span>0</span><span>-9</span><span>-18</span><span>-27</span><span>-36</span><span>-54</span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', gap: '4px' }}>
          <div style={{ flex: 1, width: '22px', background: '#252b33', borderRadius: '2px', position: 'relative', border: '1px solid #111' }}>
            {/* Target lines */}
            <div style={{ position: 'absolute', top: '23.3%', width: '100%', height: '1px', background: '#d9972b', left: '-4px', zIndex: 2 }} /> {/* -14 */}
            <div style={{ position: 'absolute', top: '38.3%', width: '100%', height: '1px', background: '#d9972b', left: '-4px', zIndex: 2 }} /> {/* -23 */}
            
            {/* M Meter Fill */}
            <div style={{ 
              position: 'absolute', bottom: 0, left: 0, width: '100%', height: `${pct(meter.lufsM)}%`, 
              background: '#b5b5b5', transition: 'height 0.1s ease-out' 
            }} />
            
            {/* S Meter overlay (slightly darker/different to show layering) */}
            <div style={{ 
              position: 'absolute', bottom: 0, left: '25%', width: '50%', height: `${pct(meter.lufsS)}%`, 
              background: 'rgba(0,0,0,0.2)', transition: 'height 0.1s ease-out' 
            }} />
            
            {/* Top red zone if > 0 */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '10%', background: 'rgba(189,52,52,0.8)' }} />
          </div>
          <span style={{ fontSize: '11px', color: '#b5b5b5', fontWeight: 600 }}>LUFS</span>
        </div>
      </div>

      {/* Right Column: Values */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
        
        <div style={{ background: '#749ccb', borderRadius: '4px', padding: '6px', textAlign: 'center', color: '#0d1620' }}>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{formatDb(meter.lufsI)} LUFS</div>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px', marginTop: '2px' }}>INTEGRATED</div>
        </div>

        <div style={{ background: '#2b323c', borderRadius: '4px', padding: '6px', textAlign: 'center', color: '#e5e7eb' }}>
          <div style={{ fontSize: '16px', fontWeight: 500 }}>{formatDb(meter.lufsS)} LUFS</div>
          <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.5px', color: '#9ca3af', marginTop: '2px' }}>SHORT TERM</div>
        </div>

        <div style={{ background: '#2b323c', borderRadius: '24px', padding: '4px 12px', textAlign: 'center', color: '#e5e7eb', marginTop: '4px', border: '1px solid #1e2329' }}>
          <div style={{ fontSize: '12px', fontWeight: 500 }}>{formatDb(maxVals.lufsM)} LUFS</div>
          <div style={{ fontSize: '8px', fontWeight: 600, color: '#9ca3af' }}>MOMENTARY MAX</div>
        </div>

        <div style={{ background: '#2b323c', borderRadius: '24px', padding: '4px 12px', textAlign: 'center', color: '#e5e7eb', border: '1px solid #1e2329' }}>
          <div style={{ fontSize: '12px', fontWeight: 500 }}>{formatDb(maxVals.lufsS)} LUFS</div>
          <div style={{ fontSize: '8px', fontWeight: 600, color: '#9ca3af' }}>SHORT TERM MAX</div>
        </div>

        <div style={{ background: '#2b323c', borderRadius: '24px', padding: '4px 12px', textAlign: 'center', color: '#e5e7eb', border: '1px solid #1e2329' }}>
          <div style={{ fontSize: '12px', fontWeight: 500 }}>{formatDb(maxVals.peak)} dB</div>
          <div style={{ fontSize: '8px', fontWeight: 600, color: '#9ca3af' }}>TRUE PEAK MAX</div>
        </div>

      </div>
    </div>
  );
}
