import type { Project } from './types';
import { audioAssets, putAsset } from '../audio/assets';
import { encodeWav } from '../audio/export';

// Autosave: the document goes to localStorage, decoded audio to IndexedDB (too big for localStorage).
// Project files (.roomtone) are JSON with audio embedded as base64 WAV so a single file round-trips.

const KEY = 'roomtone.project.v1';
const PRESETS = 'roomtone.musicianPresets.v1';

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('roomtone', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('audio');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function idbPut(id: string, buf: AudioBuffer) {
  const db = await idb();
  const channels = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c).slice());
  await new Promise<void>((res, rej) => {
    const tx = db.transaction('audio', 'readwrite');
    tx.objectStore('audio').put({ sampleRate: buf.sampleRate, channels }, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function idbGet(id: string): Promise<AudioBuffer | null> {
  const db = await idb();
  const v = await new Promise<{ sampleRate: number; channels: Float32Array[] } | undefined>((res, rej) => {
    const r = db.transaction('audio').objectStore('audio').get(id);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  if (!v) return null;
  const b = new AudioBuffer({ length: v.channels[0].length, numberOfChannels: v.channels.length, sampleRate: v.sampleRate });
  v.channels.forEach((c, i) => b.copyToChannel(c as Float32Array<ArrayBuffer>, i));
  return b;
}

let saveTimer = 0;
const persisted = new Set<string>();

export function autosave(p: Project) {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
      for (const id of Object.keys(p.audio)) {
        const b = audioAssets.get(id);
        if (b && !persisted.has(id)) {
          await idbPut(id, b);
          persisted.add(id);
        }
      }
    } catch (e) {
      console.warn('Autosave failed', e);
    }
  }, 600);
}

export async function loadAutosave(): Promise<Project | null> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Project;
    if (p.version !== 1) return null;
    for (const id of Object.keys(p.audio)) {
      const b = await idbGet(id).catch(() => null);
      if (b) {
        putAsset(id, b);
        persisted.add(id);
      }
    }
    return p;
  } catch {
    return null;
  }
}

async function blobToBase64(b: Blob) {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function exportProjectFile(p: Project): Promise<Blob> {
  const audio: Record<string, string> = {};
  for (const id of Object.keys(p.audio)) {
    const b = audioAssets.get(id);
    if (b) audio[id] = await blobToBase64(encodeWav(b, 16));
  }
  return new Blob([JSON.stringify({ format: 'roomtone', project: p, audio })], { type: 'application/json' });
}

export async function importProjectFile(file: File, ctx: BaseAudioContext): Promise<Project> {
  const data = JSON.parse(await file.text());
  if (data.format !== 'roomtone' || !data.project || data.project.version !== 1) throw new Error('Not a RoomTone project file');
  for (const [id, b64] of Object.entries(data.audio ?? {}) as [string, string][]) {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    putAsset(id, await ctx.decodeAudioData(bin.buffer));
  }
  return data.project as Project;
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

import type { MusicianLook } from './types';
export function loadPresets(): MusicianLook[] {
  try {
    return JSON.parse(localStorage.getItem(PRESETS) ?? '[]');
  } catch {
    return [];
  }
}
export function savePresets(list: MusicianLook[]) {
  localStorage.setItem(PRESETS, JSON.stringify(list));
}
