// Canyon Ridge Run — sound, synthesised live with WebAudio.
// One job: engine hum that follows the throttle, a chime for each ring, and
// thuds for landing and crashing. No audio files, no network.

/** Lazily built on the first user gesture (browsers demand one). */
export class EngineAudio {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.propOsc = null;
    this.ready = false;
  }

  /** Create the audio graph. Safe to call repeatedly; only the first builds. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      // Engine: a low sawtooth plus a faster buzz, mixed quiet under the game.
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineOsc.start();
      this.propOsc = this.ctx.createOscillator();
      this.propOsc.type = 'square';
      this.propOsc.frequency.value = 22;
      const propGain = this.ctx.createGain();
      propGain.gain.value = 0.25;
      this.propOsc.connect(propGain);
      propGain.connect(this.engineGain);
      this.propOsc.start();
      this.ready = true;
    } catch {
      this.ctx = null;
      this.ready = false;
    }
  }

  /** Follow the throttle: louder and higher as the engine spools up. */
  setThrottle(throttle, speed) {
    if (!this.ready || !this.ctx) return;
    const t = this.ctx.currentTime;
    const hum = 0.02 + throttle * 0.05 + Math.min(0.02, speed * 0.0004);
    this.engineGain.gain.setTargetAtTime(hum, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(52 + throttle * 68, t, 0.1);
    this.propOsc.frequency.setTargetAtTime(18 + throttle * 42, t, 0.1);
  }

  /** Two-note chime when a ring is flown. */
  chime() {
    this._tone(880, 0.12, 0.16, 'sine');
    window.setTimeout(() => this._tone(1318, 0.18, 0.2, 'sine'), 90);
  }

  /** Soft double thump for a landing. */
  landThud() {
    this._tone(90, 0.25, 0.3, 'triangle');
    window.setTimeout(() => this._tone(70, 0.3, 0.25, 'triangle'), 140);
  }

  /** Low crunch for a crash. */
  crashThud() {
    this._tone(55, 0.4, 0.5, 'sawtooth');
    window.setTimeout(() => this._tone(40, 0.5, 0.4, 'sawtooth'), 120);
  }

  _tone(freq, dur, vol, type) {
    if (!this.ready || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Silence the engine (title screen, game over). */
  hush() {
    if (!this.ready || !this.ctx) return;
    this.engineGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.15);
  }
}
