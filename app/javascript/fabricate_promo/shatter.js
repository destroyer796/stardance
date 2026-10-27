// The page the rocket hits, smashed. Each shard is a frozen copy of the site clipped to a wedge
// fanning out from the shatter's origin (timeline.shatter.x and y, set apart from where the
// explosion lands), so when the copies crack apart and fall it looks like the page
// itself breaking. The copies are taken up front, while the clip is still loading, and stay hidden
// over the real page until the rocket lands.
//
// Like the door, it's drawn from a time (`at`), in seconds into the strike, so it can be scrubbed.
import { applyJolt, joltAt } from "./blast_door";
import timeline from "./timeline";

const SVG = "http://www.w3.org/2000/svg";

export default class Shatter {
  constructor() {
    this.origin = {
      x: window.innerWidth * timeline.shatter.x,
      y: window.innerHeight * timeline.shatter.y,
    };
    this.layer = document.createElement("div");
    this.layer.className = "fabricate-shatter";
    this.pieces = document.createElement("div");
    this.pieces.className = "fabricate-shatter__pieces";
    this.layer.append(this.pieces);
    const rays = castRays();
    const cracks = this.drawCracks(rays);
    this.shards = rays.map((from, i) =>
      this.cutShard(from, rays[i + 1] ?? rays[0] + Math.PI * 2, cracks),
    );
  }

  // Under everything else in the overlay, so the fire and the door play over the wreckage.
  mount(overlay) {
    overlay.prepend(this.layer);
    for (const shard of this.shards) this.restoreScroll(shard.page);
  }

  // A crack along every ray, plus a broken ring round the origin.
  drawCracks(rays) {
    const { x, y } = this.origin;
    const reach = Math.hypot(window.innerWidth, window.innerHeight);
    const lines = rays.map((angle) => {
      let path = `M${x} ${y}`;
      for (let r = 60; r < reach; r += 80 + Math.random() * 120) {
        const wobble = angle + (Math.random() - 0.5) * 0.08;
        path += ` L${x + Math.cos(wobble) * r} ${y + Math.sin(wobble) * r}`;
      }
      return path;
    });
    const ring = rays.map((angle) => {
      const r = 70 + Math.random() * 50;
      return `${x + Math.cos(angle) * r} ${y + Math.sin(angle) * r}`;
    });
    lines.push(`M${ring.join(" L")} Z`);

    const svg = document.createElementNS(SVG, "svg");
    svg.classList.add("fabricate-shatter__cracks");
    for (const d of lines) {
      const path = document.createElementNS(SVG, "path");
      path.setAttribute("d", d);
      path.setAttribute("pathLength", "1");
      path.style.strokeDasharray = "1";
      path.style.strokeDashoffset = "1";
      svg.append(path);
    }
    return svg;
  }

  // The wedge between two rays, with its share of the cracks.
  cutShard(from, to, cracks) {
    const { x, y } = this.origin;
    const far = Math.hypot(window.innerWidth, window.innerHeight) * 2;
    const point = (angle) =>
      `${x + Math.cos(angle) * far}px ${y + Math.sin(angle) * far}px`;
    const element = document.createElement("div");
    element.className = "fabricate-shatter__shard";
    element.style.clipPath = `polygon(${x}px ${y}px, ${point(from)}, ${point((from + to) / 2)}, ${point(to)})`;
    const page = this.copyPage();
    element.append(page, cracks.cloneNode(true));
    this.pieces.append(element);

    // Flung out from the origin, up a little, then left to gravity, spinning about its middle.
    const { minSpeed, maxSpeed, kick, spin } = timeline.shatter;
    const mid = (from + to) / 2;
    element.style.transformOrigin = `${x + Math.cos(mid) * 300}px ${y + Math.sin(mid) * 300}px`;
    const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
    return {
      element,
      page,
      vx: Math.cos(mid) * speed,
      vy: Math.sin(mid) * speed - kick,
      spin: (Math.random() - 0.5) * spin,
    };
  }

  // A lifeless copy of the page: no controllers, frames or scripts that would wake up in it.
  copyPage() {
    this.template ??= this.snapshot();
    const page = document.createElement("div");
    page.className = "fabricate-shatter__page";
    page.style.background = getComputedStyle(
      document.documentElement,
    ).backgroundColor;
    page.append(this.template.cloneNode(true));
    return page;
  }

  snapshot() {
    const scrolled = [...document.body.querySelectorAll("*")].filter(
      (element) => element.scrollTop || element.scrollLeft,
    );
    for (const element of scrolled)
      element.dataset.fabricateScroll = `${element.scrollTop} ${element.scrollLeft}`;
    const copy = document.body.cloneNode(true);
    for (const element of scrolled) delete element.dataset.fabricateScroll;

    copy
      .querySelectorAll(
        "script, iframe, turbo-frame[src], turbo-cable-stream-source, .fabricate-promo__overlay",
      )
      .forEach((element) => element.remove());
    for (const element of [copy, ...copy.querySelectorAll("*")]) {
      element.removeAttribute("id");
      for (const { name } of [...element.attributes]) {
        if (/^data-(controller|action|turbo)/.test(name))
          element.removeAttribute(name);
      }
    }
    // The page scrolls on <html>, which the copy doesn't have; its scroll lands on the copy's
    // wrapper instead.
    this.pageScroll = `${document.documentElement.scrollTop} ${document.documentElement.scrollLeft}`;
    return copy;
  }

  restoreScroll(page) {
    const scroll = (element, value) => {
      const [top, left] = value.split(" ").map(Number);
      element.scrollTop = top;
      element.scrollLeft = left;
    };
    scroll(page, this.pageScroll);
    for (const element of page.querySelectorAll("[data-fabricate-scroll]"))
      scroll(element, element.dataset.fabricateScroll);
  }

  // The shattered page `time` seconds into the strike. Until the crack it's hidden over the real
  // page; then the cracks race out from the origin, the pieces shake, and from the fall they fly
  // apart under gravity.
  at(time) {
    const { crack, fall } = timeline.cues;
    const { crackMs, fallMs, shakeMs, shakePx, gravity } = timeline.shatter;
    this.layer.classList.toggle("fabricate-shatter--cracked", time >= crack);
    const drawn = crackMs ? (time - crack) / (crackMs / 1000) : 1;
    this.paths ??= this.layer.querySelectorAll(
      ".fabricate-shatter__cracks path",
    );
    for (const path of this.paths)
      path.style.strokeDashoffset = 1 - Math.min(1, Math.max(0, drawn));
    applyJolt(this.pieces, joltAt(time - crack, shakeMs / 1000, shakePx));

    const t = Math.min(Math.max(0, time - fall), fallMs / 1000);
    for (const { element, vx, vy, spin } of this.shards) {
      const x = vx * t;
      const y = vy * t + (gravity * t * t) / 2;
      element.style.transform = `translate(${x}px, ${y}px) rotate(${spin * t}deg)`;
    }
  }

  destroy() {
    this.layer.remove();
  }
}

// Rays out from the origin at uneven angles, in order round the circle.
function castRays() {
  const { minShards, maxShards } = timeline.shatter;
  const count =
    minShards + Math.floor(Math.random() * (maxShards - minShards + 1));
  const step = (Math.PI * 2) / count;
  const start = Math.random() * step;
  return Array.from(
    { length: count },
    (_, i) => start + i * step + (Math.random() - 0.5) * step * 0.6,
  );
}
