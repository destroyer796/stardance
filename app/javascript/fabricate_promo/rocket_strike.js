// A stock green-screen rocket strike ("Rocket Blast Green Screen Effect" by Jacob Jones on
// YouTube) keyed over the page: the rocket streaks in trailing smoke, hits the page and goes up in a
// fireball and a column of black smoke. The blast door then slams shut while it's still burning.
//
// The clip ships as VP9 WebM with an H.264 MP4 fallback, still on its green; the green is keyed out
// live in a WebGL shader, since Safari can't play video with an alpha channel.
import timeline from "./timeline";

const MAX_DPR = 2;
// Where the ground the rocket hits sits in the clip.
const GROUND = 0.83;
const LOAD_TIMEOUT_MS = 2000;

// Anything clearly greener than it is red or blue goes transparent, with a soft edge, and what's
// left has its green pulled down to the average of red and blue, so neither the smoke nor the
// fireball is tinted by the screen behind it.
const VERTEX = `
  attribute vec2 corner;
  varying vec2 uv;
  void main() {
    uv = vec2(corner.x * 0.5 + 0.5, 0.5 - corner.y * 0.5);
    gl_Position = vec4(corner, 0.0, 1.0);
  }
`;
const FRAGMENT = `
  precision mediump float;
  uniform sampler2D frame;
  varying vec2 uv;
  void main() {
    vec4 color = texture2D(frame, uv);
    float spill = color.g - max(color.r, color.b);
    float alpha = 1.0 - smoothstep(0.12, 0.34, spill);
    color.g = min(color.g, (color.r + color.b) * 0.5 + 0.04);
    gl_FragColor = vec4(color.rgb * alpha, alpha);
  }
`;

export default class RocketStrike {
  // Start fetching the clip ahead of the click, so it's ready to roll the moment it's pressed.
  static preload({ webm, mp4 }) {
    const video = document.createElement("video");
    video.src = video.canPlayType('video/webm; codecs="vp9, opus"')
      ? webm
      : mp4;
    video.preload = "auto";
    video.playsInline = true;
    return video;
  }

  // Where on the screen the rocket lands, in viewport pixels.
  static get impact() {
    return {
      x: window.innerWidth * timeline.impact.x,
      y: window.innerHeight * timeline.impact.y,
    };
  }

  constructor(video) {
    this.video = video;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "fabricate-promo__strike";
    this.gl = this.canvas.getContext("webgl", { premultipliedAlpha: true });
  }

  // Without WebGL there's no keying, so the strike is skipped and the doors come straight in.
  get supported() {
    return !!this.gl;
  }

  // Under the door, so the leaves close over the fire.
  mount(overlay) {
    overlay.prepend(this.canvas);
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
    this.setUpShader();
  }

  setUpShader() {
    const { gl } = this;
    const program = gl.createProgram();
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, FRAGMENT],
    ]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const corner = gl.getAttribLocation(program, "corner");
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    for (const [param, value] of [
      [gl.TEXTURE_MIN_FILTER, gl.LINEAR],
      [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
    ])
      gl.texParameteri(gl.TEXTURE_2D, param, value);
    gl.clearColor(0, 0, 0, 0);
  }

  // Cover the screen with the clip, with the explosion's ground on the impact point. The clip is
  // never lifted, so the explosion can't land off the bottom.
  placeClip() {
    const { canvas, video } = this;
    const scale = Math.max(
      canvas.width / video.videoWidth,
      canvas.height / video.videoHeight,
    );
    const width = video.videoWidth * scale;
    const height = video.videoHeight * scale;
    const top = Math.min(
      0,
      canvas.height * timeline.impact.y - height * GROUND,
    );
    this.gl.viewport(
      canvas.width * timeline.impact.x - width / 2,
      canvas.height - top - height,
      width,
      height,
    );
  }

  // Plays the clip and fires each cue ({ at, run }, `at` in seconds into the clip) as the clip
  // reaches it. Resolves once they've all fired; the clip keeps playing until it's destroyed.
  async run(cues) {
    await this.ready();
    this.placeClip();
    this.video.playbackRate = timeline.speed;
    await this.video.play();
    this.running = true;
    const pending = [...cues];
    return new Promise((resolve) => {
      const frame = () => {
        if (!this.running) return;
        this.draw();
        this.fade();
        const time = this.video.ended ? Infinity : this.video.currentTime;
        for (const cue of pending.filter(({ at }) => time >= at)) {
          pending.splice(pending.indexOf(cue), 1);
          cue.run();
        }
        if (!pending.length) resolve();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }

  // The clip's picture and sound each fade in from the start and out from their own cue.
  fade() {
    const { clip, volume } = timeline;
    const time = this.video.currentTime;
    this.canvas.style.opacity = envelope(
      time,
      clip.fadeInMs,
      clip.fadeOutAt,
      clip.fadeOutMs,
    );
    this.video.volume = Math.min(
      1,
      volume.clip *
        envelope(
          time,
          clip.soundFadeInMs,
          clip.soundFadeOutAt,
          clip.soundFadeOutMs,
        ),
    );
  }

  ready() {
    if (this.video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA)
      return Promise.resolve();
    return new Promise((resolve) => {
      this.video.addEventListener("canplaythrough", resolve, { once: true });
      setTimeout(resolve, LOAD_TIMEOUT_MS);
    });
  }

  draw() {
    const { gl, video } = this;
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  destroy() {
    this.running = false;
    this.video.pause();
    this.canvas.remove();
  }
}

// 0 to 1 over `inMs` from the start, and back to 0 over `outMs` from `outAt` seconds. A zero-length
// fade is a cut.
function envelope(time, inMs, outAt, outMs) {
  const ramp = (x) => (Number.isNaN(x) ? 1 : Math.min(1, Math.max(0, x)));
  return Math.min(
    ramp(time / (inMs / 1000)),
    1 - ramp((time - outAt) / (outMs / 1000)),
  );
}
