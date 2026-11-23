// These cues share the game's noise source, envelopes, and SFX volume.
export function playStairCue(cue, now, tone, noise, blood = false) {
  const knock = (at, strength, pitch) => {
    tone(at, "sine", pitch, pitch * .52, .16, .20 * strength, .003);
    noise(at + .003, .075, "bandpass", 510, 270, 1.3, .23 * strength, .003);
  };

  switch (cue) {
    case "step":
      knock(now, .48, 142);
      noise(now + .015, .075, "highpass", 1780, 1000, .65, .09, .012);
      break;
    case "tread":
      knock(now, .78, 165);
      noise(now + .026, .17, "bandpass", 770, 420, 5, .13, .025);
      tone(now + .093, "triangle", 1220, 990, .04, .062, .002);
      break;
    case "latch":
      for (const [offset, pitch, strength] of [[0, 1450, .15], [.056, 1170, .11], [.102, 790, .085]]) {
        tone(now + offset, "triangle", pitch, pitch * .84, .068, strength, .002);
        noise(now + offset, .033, "highpass", 3050, 2140, .8, strength * .88, .002);
      }
      noise(now + .109, .16, "bandpass", 590, 1040, 4, .11, .026);
      break;
    case "drop":
      noise(now, .235, "bandpass", 620, 2050, 1.15, .22, .042);
      noise(now + .024, .20, "highpass", 2580, 4560, .8, .12, .085);
      tone(now + .035, "triangle", 360, 178, .24, .10, .055);
      break;
    case "impact":
      // The low hit, brittle break, and organic burst each occupy their own band.
      tone(now, "sine", 106, 31, .38, .45, .002);
      noise(now, .17, "lowpass", 670, 165, 1.6, .32, .003);
      noise(now + .007, .067, "highpass", 1900, 1350, .85, .23, .002);
      tone(now + .009, "triangle", 770, 340, .09, .12, .002);
      for (const [offset, pitch, strength] of [[.018, 1830, .21], [.041, 1220, .17], [.069, 790, .095]]) {
        noise(now + offset, .065, "bandpass", pitch, pitch * .70, 2.4, strength, .002);
      }
      // Faint early reflections in the narrow stairwell.
      noise(now + .105, .22, "bandpass", 810, 450, 1.2, .065, .018);
      tone(now + .082, "sine", 61, 43, .22, .11, .014);
      if (blood) {
        noise(now + .024, .255, "bandpass", 435, 205, 2.1, .28, .013);
        noise(now + .042, .17, "bandpass", 2450, 1050, 1.4, .19, .008);
        for (const [offset, pitch, strength] of [[.085, 540, .115], [.126, 925, .095], [.181, 630, .085], [.238, 1080, .055]]) {
          tone(now + offset, "sine", pitch * .75, pitch, .068, strength, .004);
        }
      }
      break;
    case "splash":
      for (const [offset, pitch, strength] of [[0, 830, .12], [.043, 1450, .09], [.091, 1100, .075], [.155, 1540, .062], [.239, 1170, .044]]) {
        noise(now + offset, .055, "bandpass", pitch, pitch * .64, 1.8, strength, .003);
      }
      noise(now + .025, .28, "bandpass", 2600, 920, 1.6, .105, .018);
      break;
    case "treads":
      knock(now, 1, 122);
      knock(now + .22, .68, 155);
      noise(now + .028, .35, "bandpass", 1050, 570, 1.5, .15, .030);
      noise(now + .21, .13, "highpass", 2100, 1430, .65, .075, .017);
      break;
    case "floor":
      knock(now, .96, 83);
      noise(now + .014, .26, "bandpass", 870, 460, 1.3, .13, .030);
      noise(now + .16, .15, "highpass", 2040, 1120, .55, .065, .026);
      tone(now + .29, "sine", 138, 85, .08, .057, .009);
      break;
    case "drops":
      for (const [offset, pitch, strength] of [[0, 235, .10], [.10, 615, .095], [.19, 480, .065], [.36, 690, .047]]) {
        tone(now + offset, "sine", pitch, pitch * .6, .073, strength, .005);
        noise(now + offset + .004, .049, "bandpass", pitch * 2, pitch, 2, strength * .8, .005);
      }
      break;
  }
}
