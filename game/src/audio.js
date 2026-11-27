// Synthesised sound — WebAudio only, no audio files. Everything is created
// lazily on the first user gesture, so the game stays silent until played.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);

      // Engine: two detuned saws through a low-pass, pitch follows the throttle.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 62;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 93;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();

      // Wind: looped noise through a band-pass, loudness follows airspeed.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = ctx.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0.0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSource.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    // Called every frame while playing: throttle 0..1, speed in knots.
    update(throttle, speed, playing) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const on = playing ? 1 : 0;
      engineGain.gain.setTargetAtTime(0.055 * on * (0.4 + throttle), t, 0.1);
      engineOsc.frequency.setTargetAtTime(58 + throttle * 95, t, 0.1);
      engineOsc2.frequency.setTargetAtTime(87 + throttle * 142, t, 0.1);
      windGain.gain.setTargetAtTime(0.05 * on * Math.min(1, speed / 140), t, 0.15);
      windFilter.frequency.setTargetAtTime(500 + speed * 6, t, 0.15);
    },
    ring() {
      blip(880, 0.16, 'sine', 0.22);
      blip(1318, 0.28, 'sine', 0.2, 0.09);
    },
    nearMiss() { blip(660, 0.12, 'triangle', 0.14); },
    crash() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const len = ctx.sampleRate * 0.5;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t);
      blip(55, 0.5, 'sine', 0.4);
    },
    land() {
      [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.3, 'sine', 0.2, i * 0.11));
    },
    click() { blip(1200, 0.05, 'square', 0.06); },
  };
}
