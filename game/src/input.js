// Canyon Ridge Run — keyboard and mouse.
// One job: turn keys and pointer movement into a stick the flight model reads.

const KEY_PITCH_UP = ['ArrowUp', 'KeyW'];
const KEY_PITCH_DOWN = ['ArrowDown', 'KeyS'];
const KEY_ROLL_LEFT = ['ArrowLeft', 'KeyA'];
const KEY_ROLL_RIGHT = ['ArrowRight', 'KeyD'];
const KEY_THROTTLE_UP = ['ShiftLeft', 'ShiftRight'];
const KEY_BRAKE = ['Space'];
const KEY_RESTART = ['KeyR', 'Enter'];

/** Reads the keyboard and the mouse; call poll() once per frame. */
export class Input {
  constructor() {
    this.keys = new Set();
    this.mouseX = 0; // -1..1 across the window
    this.mouseActive = false;
    this.clicked = false;
    this.onFirstGesture = null;
    this._gestured = false;
    this._onKeyDown = (e) => this._key(e, true);
    this._onKeyUp = (e) => this._key(e, false);
    this._onMouse = (e) => {
      this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseActive = true;
      this._gesture();
    };
    this._onClick = () => {
      this.clicked = true;
      this._gesture();
    };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouse);
    window.addEventListener('mousedown', this._onClick);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouse);
    window.removeEventListener('mousedown', this._onClick);
  }

  _key(e, down) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (down) this._gesture();
    if (down) this.keys.add(e.code);
    else this.keys.delete(e.code);
  }

  _gesture() {
    if (!this._gestured) {
      this._gestured = true;
      if (this.onFirstGesture) this.onFirstGesture();
    }
  }

  _held(codes) {
    return codes.some((c) => this.keys.has(c));
  }

  /** Current stick position: pitch/roll -1..1, throttleDelta -1..1. */
  poll() {
    let pitch = 0;
    let roll = 0;
    if (this._held(KEY_PITCH_UP)) pitch += 1;
    if (this._held(KEY_PITCH_DOWN)) pitch -= 1;
    if (this._held(KEY_ROLL_LEFT)) roll -= 1;
    if (this._held(KEY_ROLL_RIGHT)) roll += 1;
    // Mouse steers too: hold the pointer off-centre to bank that way.
    if (this.mouseActive && Math.abs(this.mouseX) > 0.12) {
      roll += this.mouseX * 0.9;
    }
    let throttleDelta = 0;
    if (this._held(KEY_THROTTLE_UP)) throttleDelta += 1;
    if (this._held(KEY_BRAKE)) throttleDelta -= 1;
    roll = Math.max(-1, Math.min(1, roll));
    const restartPressed = this._held(KEY_RESTART);
    const clicked = this.clicked;
    this.clicked = false;
    return { pitch, roll, throttleDelta, restartPressed, clicked };
  }
}
