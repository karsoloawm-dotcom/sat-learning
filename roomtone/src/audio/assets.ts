// Decoded audio for imported/recorded clips and sampler sources, keyed by the project's audio asset id.
// AudioBuffers are context-independent, so the same buffers feed realtime playback and offline export.
// Persistence (IndexedDB / project files) lives in state/persistence.ts.
export const audioAssets = new Map<string, AudioBuffer>();

const listeners = new Set<() => void>();
export function onAssetsChanged(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function putAsset(id: string, buf: AudioBuffer) {
  audioAssets.set(id, buf);
  listeners.forEach((l) => l());
}

// Peak data for waveform drawing, cached per asset.
const peakCache = new Map<string, Float32Array>();
export function peaks(id: string, buckets = 2048): Float32Array | null {
  const buf = audioAssets.get(id);
  if (!buf) return null;
  const key = `${id}|${buckets}`;
  let out = peakCache.get(key);
  if (out) return out;
  out = new Float32Array(buckets);
  const ch = buf.getChannelData(0);
  const step = ch.length / buckets;
  for (let b = 0; b < buckets; b++) {
    let m = 0;
    const end = Math.min(ch.length, Math.floor((b + 1) * step));
    for (let i = Math.floor(b * step); i < end; i++) m = Math.max(m, Math.abs(ch[i]));
    out[b] = m;
  }
  peakCache.set(key, out);
  return out;
}
