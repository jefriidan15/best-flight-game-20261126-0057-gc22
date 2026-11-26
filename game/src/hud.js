// Canyon Ridge Run — the HUD: lit instruments and messages.
// One job: show altitude, speed, heading, throttle, fuel, score and rings,
// plus an attitude ball and a compass strip, all readable at a glance.

import { headingDegrees, altitudeAboveGround } from './flight.js';

function el(id) {
  return document.getElementById(id);
}

/** Owns the DOM overlay and the little attitude-instrument canvas. */
export class Hud {
  constructor() {
    this.alt = el('hud-alt');
    this.spd = el('hud-spd');
    this.hdg = el('hud-hdg');
    this.thr = el('hud-thr');
    this.thrBar = el('hud-thr-bar');
    this.fuel = el('hud-fuel');
    this.fuelBar = el('hud-fuel-bar');
    this.score = el('hud-score');
    this.rings = el('hud-rings');
    this.msg = el('hud-message');
    this.overlay = el('overlay');
    this.overlayTitle = el('overlay-title');
    this.overlayBody = el('overlay-body');
    this.overlayHint = el('overlay-hint');
    this.instruments = el('instruments');
    this.ictx = this.instruments.getContext('2d');
    this._lastMessage = '';
  }

  /** Refresh every readout from the flight state. */
  update(state) {
    this.alt.textContent = `${Math.round(altitudeAboveGround(state) * 3.28)} ft`;
    this.spd.textContent = `${Math.round(state.speed * 1.94)} kt`;
    this.hdg.textContent = `${String(Math.round(headingDegrees(state))).padStart(3, '0')}°`;
    this.thr.textContent = `${Math.round(state.throttle * 100)}%`;
    this.thrBar.style.width = `${Math.round(state.throttle * 100)}%`;
    this.fuel.textContent = `${Math.round(state.fuel)}%`;
    this.fuelBar.style.width = `${Math.round(state.fuel)}%`;
    this.fuelBar.classList.toggle('low', state.fuel < 25);
    this.score.textContent = String(state.score);
    this.rings.textContent = `${state.ringsHit}/${state.ringsTotal}`;
    const msg = state.time < state.messageUntil ? state.message : '';
    if (msg !== this._lastMessage) {
      this.msg.textContent = msg;
      this._lastMessage = msg;
    }
    this.drawInstruments(state);
  }

  /** Attitude ball + compass strip on the small 2D canvas. */
  drawInstruments(state) {
    const ctx = this.ictx;
    const w = this.instruments.width;
    const h = this.instruments.height;
    const cx = w / 2;
    const cy = h / 2 - 8;
    const r = 52;
    ctx.clearRect(0, 0, w, h);
    // Attitude ball: sky above the horizon line, earth below, rolled with the plane.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-state.roll);
    const pitchPx = state.pitch * 90;
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-r - 2, -r - 2 - pitchPx, r * 2 + 4, r + 2 + pitchPx);
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(-r - 2, -pitchPx, r * 2 + 4, r + 2 + pitchPx);
    ctx.strokeStyle = '#f5f5f5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, -pitchPx);
    ctx.lineTo(r, -pitchPx);
    ctx.stroke();
    ctx.restore();
    // Fixed wings marker over the ball.
    ctx.strokeStyle = '#ffd23d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy);
    ctx.lineTo(cx - 10, cy);
    ctx.moveTo(cx + 10, cy);
    ctx.lineTo(cx + 34, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Compass strip: ticks every 30°, cardinal letters, heading centred.
    const hdg = headingDegrees(state);
    ctx.fillStyle = 'rgba(8, 18, 30, 0.55)';
    ctx.fillRect(0, h - 26, w, 26);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let d = -60; d <= 60; d += 15) {
      const deg = Math.round((hdg + d + 360) % 360);
      const x = cx + d * 1.1;
      const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W'
        : d % 30 === 0 ? String(deg) : '';
      if (label) ctx.fillText(label, x, h - 8);
      ctx.fillRect(x, h - 26, 1, d % 30 === 0 ? 6 : 3);
    }
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.moveTo(cx - 5, h - 26);
    ctx.lineTo(cx + 5, h - 26);
    ctx.lineTo(cx, h - 19);
    ctx.closePath();
    ctx.fill();
  }

  /** Show a full-screen panel (title, crash, landed). Pass null to hide it. */
  showOverlay(title, body, hint) {
    if (!title) {
      this.overlay.classList.add('hidden');
      return;
    }
    this.overlayTitle.textContent = title;
    this.overlayBody.innerHTML = body;
    this.overlayHint.textContent = hint;
    this.overlay.classList.remove('hidden');
  }
}
