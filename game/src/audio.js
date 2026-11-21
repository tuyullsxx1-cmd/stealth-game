// audio.js — procedural WebAudio sound for the theatre.
// No audio files: every sound is synthesized. The context is created on the
// first user gesture (a key or click) so autoplay rules never block it.
// Footsteps get louder as a guard nears and pan with the guard's direction,
// so sound tells the player where a guard is.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    ambientNodes: null,
    alarmNodes: null,
  };

  audio.ensure = function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = audio.muted ? 0 : 0.9;
    audio.master.connect(audio.ctx.destination);
    audio.startAmbient();
  };

  audio.setMuted = function setMuted(m) {
    audio.muted = m;
    if (audio.master) audio.master.gain.value = m ? 0 : 0.9;
  };

  function tone(freq, dur, type, gain, when, slideTo) {
    if (!audio.ctx) return;
    const t0 = audio.ctx.currentTime + (when || 0);
    const osc = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, filterFreq, gain, pan) {
    if (!audio.ctx) return;
    const t0 = audio.ctx.currentTime;
    const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = audio.ctx.createGain();
    g.gain.value = gain;
    const panner = audio.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan || 0));
    src.connect(filter);
    filter.connect(g);
    g.connect(panner);
    panner.connect(audio.master);
    src.start(t0);
  }

  audio.startAmbient = function startAmbient() {
    if (!audio.ctx || audio.ambientNodes) return;
    const osc = audio.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const g = audio.ctx.createGain();
    g.gain.value = 0.035;
    const lfo = audio.ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = audio.ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    osc.connect(g);
    g.connect(audio.master);
    osc.start();
    lfo.start();
    audio.ambientNodes = { osc, lfo };
  };

  // One footstep. loudness 0..1 (nearer guard = louder), pan -1..1.
  audio.step = function step(loudness, pan) {
    noiseBurst(0.07, 500, 0.05 + 0.22 * loudness, pan);
  };

  audio.coin = function coin() {
    tone(2093, 0.12, 'sine', 0.16, 0);
    tone(2637, 0.18, 'sine', 0.12, 0.07);
  };

  audio.coinLand = function coinLand() {
    tone(1568, 0.1, 'triangle', 0.2, 0);
    tone(1046, 0.14, 'triangle', 0.14, 0.06);
  };

  audio.pickup = function pickup() {
    tone(880, 0.1, 'triangle', 0.18, 0);
    tone(1318, 0.16, 'triangle', 0.16, 0.07);
  };

  audio.objective = function objective() {
    tone(523, 0.12, 'triangle', 0.2, 0);
    tone(659, 0.12, 'triangle', 0.2, 0.1);
    tone(784, 0.22, 'triangle', 0.2, 0.2);
  };

  audio.smoke = function smoke() {
    noiseBurst(0.35, 900, 0.18, 0);
  };

  audio.caught = function caught() {
    tone(196, 0.3, 'sawtooth', 0.22, 0, 98);
    tone(147, 0.4, 'sawtooth', 0.18, 0.12, 73);
  };

  audio.win = function win() {
    tone(523, 0.14, 'triangle', 0.2, 0);
    tone(659, 0.14, 'triangle', 0.2, 0.12);
    tone(784, 0.14, 'triangle', 0.2, 0.24);
    tone(1046, 0.3, 'triangle', 0.22, 0.36);
  };

  audio.lose = function lose() {
    tone(392, 0.25, 'triangle', 0.18, 0, 370);
    tone(311, 0.25, 'triangle', 0.18, 0.2, 294);
    tone(233, 0.5, 'triangle', 0.2, 0.4, 220);
  };

  audio.startAlarm = function startAlarm() {
    if (!audio.ctx || audio.alarmNodes) return;
    const osc = audio.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 660;
    const g = audio.ctx.createGain();
    g.gain.value = 0.05;
    const lfo = audio.ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 2.2;
    const lfoGain = audio.ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(g);
    g.connect(audio.master);
    osc.start();
    lfo.start();
    audio.alarmNodes = { osc, lfo };
  };

  audio.stopAlarm = function stopAlarm() {
    if (!audio.alarmNodes) return;
    try { audio.alarmNodes.osc.stop(); audio.alarmNodes.lfo.stop(); } catch (e) { /* already stopped */ }
    audio.alarmNodes = null;
  };

  return audio;
}
