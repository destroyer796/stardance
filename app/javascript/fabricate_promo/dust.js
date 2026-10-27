// What the slam knocks loose, drawn on a 2D canvas in CSS pixels: grit and chips raining from the
// lintel, soft dust clouds rolling out of the seam, and sparks where the leaves bit together.
const GRAVITY = 1400;
const GRIT = ["#d6c9b0", "#b8a98f", "#8a7a66", "#5b4a3a"];
const CLOUD = "rgb(205 195 175 / 0.5)";
const SPARK = "#f1c40f";

export default class Dust {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
  }

  resize(width, height, dpr) {
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Shake debris loose all along the top edge.
  dislodge(count) {
    for (let i = 0; i < count; i++) {
      const chunk = Math.random() < 0.08;
      this.particles.push({
        kind: "grit",
        x: Math.random() * this.width,
        y: -10 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 60,
        vy: Math.random() * 120,
        size: chunk ? 6 + Math.random() * 8 : 1.5 + Math.random() * 3,
        spin: (Math.random() - 0.5) * 12,
        angle: Math.random() * Math.PI,
        color: GRIT[Math.floor(Math.random() * GRIT.length)],
        delay: Math.random() * 0.5,
        life: 3,
        age: 0,
      });
    }
    // A haze sifting down with it.
    for (let i = 0; i < count / 20; i++)
      this.cloud(Math.random() * this.width, 0, 0, 40 + Math.random() * 60);
  }

  // Puff dust out of the seam at x, both ways along the floor and up the join.
  burst(x, count) {
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      this.cloud(
        x,
        Math.random() * this.height,
        side * (60 + Math.random() * 240),
        (Math.random() - 0.5) * 40,
      );
      this.particles.push({
        kind: "spark",
        x,
        y: Math.random() * this.height,
        vx: side * (200 + Math.random() * 600),
        vy: -200 - Math.random() * 400,
        life: 0.3 + Math.random() * 0.4,
        delay: 0,
        age: 0,
      });
    }
  }

  cloud(x, y, vx, vy) {
    this.particles.push({
      kind: "cloud",
      x,
      y,
      vx,
      vy,
      size: 30 + Math.random() * 60,
      life: 1.5 + Math.random() * 1.5,
      delay: Math.random() * 0.2,
      age: 0,
    });
  }

  get settled() {
    return this.particles.length === 0;
  }

  step(dt) {
    const drag = Math.exp(-dt * 2.5);
    this.particles = this.particles.filter((p) => {
      p.age += dt;
      if (p.age < p.delay) return true;
      if (p.age - p.delay >= p.life) return false;
      if (p.kind === "cloud") {
        p.vx *= drag;
        p.vy *= drag;
        p.size += dt * 40;
      } else {
        p.vy += GRAVITY * dt * (p.kind === "spark" ? 0.6 : 1);
        p.angle += (p.spin || 0) * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return p.y < this.height + 40;
    });
  }

  draw() {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.width, this.height);
    for (const p of this.particles) {
      if (p.age < p.delay) continue;
      const t = (p.age - p.delay) / p.life;
      if (p.kind === "cloud") {
        ctx.globalAlpha = (1 - t) * Math.min(1, t * 8);
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        glow.addColorStop(0, CLOUD);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      } else if (p.kind === "spark") {
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = SPARK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
        ctx.stroke();
      } else {
        ctx.globalAlpha = Math.min(1, (1 - t) * 4);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
}
