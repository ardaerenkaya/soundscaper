/**
 * WAV Exporter — OfflineAudioContext renderer
 */

export async function exportSoundscapeToWav(tracksMap, masterVolumeDb = -3, durationSec = 30) {
  if (!tracksMap || tracksMap.size === 0) {
    throw new Error('No active tracks to export.');
  }

  const sr = 44100;
  const ch = 2;
  const frames = Math.ceil(sr * durationSec);

  const offline = new OfflineAudioContext(ch, frames, sr);

  // Master gain
  const master = offline.createGain();
  master.gain.setValueAtTime(Math.pow(10, masterVolumeDb / 20), 0);
  master.connect(offline.destination);

  const anySoloed = [...tracksMap.values()].some(t => t.isSoloed);

  const promises = [...tracksMap.values()].map(async (player) => {
    if (!player.audioBuffer) return;
    if (player.isMuted) return;
    if (anySoloed && !player.isSoloed) return;

    const src = offline.createBufferSource();
    src.buffer = player.audioBuffer;
    src.loop = !player.config.isEvent;
    src.playbackRate.setValueAtTime(player.pitchVal, 0);

    const filt = offline.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(player.filterFreq, 0);

    const gain = offline.createGain();
    gain.gain.setValueAtTime(Math.pow(10, player.volumeDb / 20), 0);

    const pan = offline.createStereoPanner();
    pan.pan.setValueAtTime(player.panVal, 0);

    src.connect(filt);
    filt.connect(gain);
    gain.connect(pan);
    pan.connect(master);

    src.start(0);
  });

  await Promise.all(promises);

  const rendered = await offline.startRendering();
  const blob = bufferToWav(rendered);

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `soundscape_${Date.now()}.wav`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 500);
}

function bufferToWav(buffer) {
  const ch = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const bps = 16;
  const bytesPer = bps / 8;
  const blockAlign = ch * bytesPer;
  const dataLen = buffer.length * blockAlign;
  const arrBuf = new ArrayBuffer(44 + dataLen);
  const v = new DataView(arrBuf);

  const w = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  w(0, 'RIFF');
  v.setUint32(4, 36 + dataLen, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * blockAlign, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, bps, true);
  w(36, 'data');
  v.setUint32(40, dataLen, true);

  const channels = [];
  for (let c = 0; c < ch; c++) channels.push(buffer.getChannelData(c));

  let off = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += bytesPer;
    }
  }

  return new Blob([arrBuf], { type: 'audio/wav' });
}
