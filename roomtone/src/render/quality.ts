// Graphics presets from phones to 4K desktops. Audio is unaffected by any of these.

export type QualityId = 'phone' | 'low' | 'medium' | 'high' | 'ultra';

export interface QualityPreset {
  id: QualityId;
  label: string;
  pixelRatio: (dpr: number, width: number) => number;
  shadowSize: number; // main shadow map; 0 = no shadows
  spotShadows: boolean; // secondary (stage spot) shadows
  ao: boolean; // ground-truth ambient occlusion
  bloom: boolean;
  atmosphere: boolean; // light shafts and dust in the air
  extraLights: boolean; // decorative fill lights
  msaa: number; // samples on the post-processing target
}

export const QUALITY: Record<QualityId, QualityPreset> = {
  phone: { id: 'phone', label: 'Phone', pixelRatio: (d) => Math.min(d, 1.25) * 0.75, shadowSize: 512, spotShadows: false, ao: false, bloom: false, atmosphere: false, extraLights: false, msaa: 0 },
  low: { id: 'low', label: 'Low', pixelRatio: () => 1, shadowSize: 1024, spotShadows: false, ao: false, bloom: true, atmosphere: false, extraLights: false, msaa: 0 },
  medium: { id: 'medium', label: 'Medium', pixelRatio: (d) => Math.min(d, 1.5), shadowSize: 2048, spotShadows: false, ao: true, bloom: true, atmosphere: true, extraLights: true, msaa: 0 },
  high: { id: 'high', label: 'High', pixelRatio: (d) => Math.min(d, 2), shadowSize: 2048, spotShadows: true, ao: true, bloom: true, atmosphere: true, extraLights: true, msaa: 4 },
  // Renders at least 3840 px wide regardless of window size (downsampled to the screen), with 4K shadow maps.
  ultra: { id: 'ultra', label: 'Ultra (4K)', pixelRatio: (d, w) => Math.min(3, Math.max(d, 3840 / Math.max(1, w))), shadowSize: 4096, spotShadows: true, ao: true, bloom: true, atmosphere: true, extraLights: true, msaa: 4 },
};

export const QUALITY_ORDER: QualityId[] = ['phone', 'low', 'medium', 'high', 'ultra'];

const KEY = 'roomtone.quality';

export function savedQuality(): QualityId | null {
  try {
    const q = localStorage.getItem(KEY) as QualityId | null;
    return q && q in QUALITY ? q : null;
  } catch {
    return null;
  }
}

export function saveQuality(q: QualityId) {
  try {
    localStorage.setItem(KEY, q);
  } catch {
    /* private mode */
  }
}

// Touch-first small screens start on the phone preset; everything else on High (auto-steps down if slow).
export function defaultQuality(): QualityId {
  const small = Math.min(screen.width, screen.height) < 820;
  const coarse = matchMedia?.('(pointer: coarse)').matches;
  return small && coarse ? 'phone' : 'high';
}
