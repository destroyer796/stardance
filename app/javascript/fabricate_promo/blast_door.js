// The Fabricate ad's toothed blast door at full screen. It stamps out the widget's door template,
// starts with both leaves slid out of sight, slams them shut over the page, shakes the screen and
// the dust loose, throws the bolts, and opens again on Fabricate's landing page.
import Dust from "./dust";
import timeline, { scaled } from "./timeline";

const MAX_DPR = 2;

export default class BlastDoor {
  constructor(template, sounds) {
    this.sounds = sounds;
    this.overlay = document.createElement("div");
    this.overlay.className = "fabricate-promo__overlay";
    this.overlay.setAttribute("aria-hidden", "true");

    this.door = template.content.firstElementChild.cloneNode(true);
    this.setGap(1);

    const canvas = document.createElement("canvas");
    canvas.className = "fabricate-promo__dust";
    this.dust = new Dust(canvas);
    this.overlay.append(this.door, canvas);
  }

  mount() {
    document.body.append(this.overlay);
    this.dust.resize(
      window.innerWidth,
      window.innerHeight,
      Math.min(window.devicePixelRatio || 1, MAX_DPR),
    );
    this.running = true;
    let last;
    const frame = (now) => {
      if (!this.running) return;
      const dt = last == null ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      this.dust.step(dt);
      this.dust.draw();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  setGap(gap) {
    this.door.style.setProperty("--fabricate-door-gap", gap);
  }

  async run() {
    await this.slam();
    await this.unlock();
    await this.open();
  }

  async slam() {
    const { closeMs, settleMs, pipeDelayMs } = timeline.door;
    this.sounds.rumble(scaled(closeMs) / 1000);
    this.pipe = setTimeout(
      () => this.sounds.play("pipe"),
      scaled(closeMs + pipeDelayMs),
    );
    await animate(scaled(closeMs), (u) => this.setGap(1 - easeIn(u)));
    this.impact();
    await wait(scaled(settleMs));
  }

  // The leaves meet: clang, shake, and everything loose comes down. Fabricate is behind the door
  // from here on.
  impact() {
    const { shakeMs, shakePx } = timeline.door;
    this.sounds.clang();
    this.door.classList.remove("fabricate-door--hollow");
    this.dust.dislodge(450);
    this.dust.burst(window.innerWidth / 2, 30);
    this.shake(scaled(shakeMs), shakePx);
    navigator.vibrate?.([120, 40, 60]);
  }

  // The locking bolts throw one at a time, each jolting the door, then the seal vents.
  async unlock() {
    const { bolts, boltMs } = timeline.door;
    for (let bolt = 0; bolt < bolts; bolt++) {
      this.sounds.clunk();
      this.shake(scaled(boltMs) * 0.7, 5);
      await wait(scaled(boltMs));
    }
    this.sounds.hiss(0, 1.2);
    this.dust.burst(window.innerWidth / 2, 8);
  }

  async open() {
    const { openMs } = timeline.door;
    this.sounds.rumble(scaled(openMs) / 1000);
    await animate(scaled(openMs), (u) => this.setGap(easeInOut(u)));
  }

  shake(ms, px) {
    shake(this.overlay, ms, px);
  }

  destroy() {
    this.running = false;
    clearTimeout(this.pipe);
    this.overlay.remove();
  }
}

// Jolts `element` about, dying away over `ms`. Only ever pass something inside the fixed overlay:
// moving the page itself pushes it past the viewport and flashes the scrollbars.
export function shake(element, ms, px) {
  return animate(ms, (u) => {
    const amount = px * (1 - u) ** 2;
    const x = (Math.random() - 0.5) * 2 * amount;
    const y = (Math.random() - 0.5) * 2 * amount;
    element.style.transform =
      u < 1 ? `translate(${x}px, ${y}px) rotate(${x * 0.02}deg)` : "";
  });
}

export function animate(ms, step) {
  return new Promise((resolve) => {
    let start;
    const frame = (now) => {
      start ??= now;
      const u = Math.min(1, (now - start) / ms);
      step(u);
      if (u < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const easeIn = (t) => t * t * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
