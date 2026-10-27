import { Controller } from "@hotwired/stimulus";
import BlastDoor from "../fabricate_promo/blast_door";
import Cutscene from "../fabricate_promo/cutscene";
import DoorSounds from "../fabricate_promo/door_sounds";
import RocketStrike from "../fabricate_promo/rocket_strike";
import Shatter from "../fabricate_promo/shatter";
import timeline from "../fabricate_promo/timeline";

export default class extends Controller {
  static targets = ["card", "door"];
  static values = {
    url: String,
    cutscene: Boolean,
    strikeWebm: String,
    strikeMp4: String,
    shatterSound: String,
    pipeSound: String,
  };

  connect() {
    this.reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    this.onPageShow = (event) => {
      if (event.persisted) this.reset();
    };
    window.addEventListener("pageshow", this.onPageShow);
  }

  disconnect() {
    window.removeEventListener("pageshow", this.onPageShow);
    this.reset();
  }

  // Start loading the rocket clip as soon as the button looks likely to be pressed.
  warm() {
    if (this.reduceMotion || this.cutsceneValue) return;
    this.clip ??= RocketStrike.preload({
      webm: this.strikeWebmValue,
      mp4: this.strikeMp4Value,
    });
  }

  // The siren goes off while a mouse is over the button itself.
  alarm(event) {
    if (this.reduceMotion || this.launching || event.pointerType === "touch")
      return;
    if (!this.siren) {
      this.siren = document.createElement("div");
      this.siren.className = "fabricate-alarm";
      this.siren.setAttribute("aria-hidden", "true");
      this.siren.innerHTML = `
        <div class="fabricate-alarm__wash"></div>
        <div class="fabricate-alarm__beams"></div>
        <div class="fabricate-alarm__beacon"></div>
      `;
      document.body.append(this.siren);
    }
    // Next frame, so a freshly added siren fades in rather than popping on.
    requestAnimationFrame(() =>
      this.siren?.classList.add("fabricate-alarm--on"),
    );
  }

  calm() {
    this.siren?.remove();
    this.siren = null;
  }

  async launch(event) {
    if (this.reduceMotion) return;
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    if (this.launching) return;
    // Count now, even if the visitor leaves during the animation. The final
    // navigation bypasses this endpoint so the click is only recorded once.
    fetch(this.cardTarget.href, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      keepalive: true,
    }).catch(() => {
      // Don't retry: the server may have counted a request whose response failed.
    });
    await this.play();
    window.location.assign(this.urlValue);
  }

  // The whole show, from the button going down to the door opening on Fabricate.
  async play() {
    this.launching = true;
    this.calm();
    this.cardTarget.classList.add("fabricate-promo__card--pressed");
    this.sounds = new DoorSounds({
      shatter: this.shatterSoundValue,
      pipe: this.pipeSoundValue,
    });
    this.sounds.press();
    this.door = new BlastDoor(this.doorTarget, this.sounds);
    if (this.cutsceneValue) {
      this.cutscene = new Cutscene(this.door, this.sounds);
      this.cutscene.lock();
    }
    this.door.mount();
    if (this.cutscene) {
      await this.cutscene.play();
    } else {
      // The rocket comes down on the page and smashes it, and the doors slam shut while the
      // pieces are still falling.
      this.warm();
      this.strike = new RocketStrike(this.clip);
      if (this.strike.supported) {
        this.shatter = new Shatter(RocketStrike.impact);
        this.strike.mount(this.door.overlay);
        this.shatter.mount(this.door.overlay);
        let doorway;
        const { cues } = timeline;
        await this.strike.run([
          {
            at: cues.crack,
            run: () => {
              this.shatter.crack();
              navigator.vibrate?.([200, 60, 120]);
            },
          },
          { at: cues.shatterSound, run: () => this.sounds.play("shatter") },
          { at: cues.fall, run: () => this.shatter.fall() },
          { at: cues.doors, run: () => (doorway = this.door.run()) },
        ]);
        await doorway;
      } else {
        await this.door.run();
      }
    }
  }

  // Coming back through the back/forward cache restores the page mid-strike.
  reset() {
    this.calm();
    if (!this.launching) return;
    this.cutscene?.destroy();
    this.shatter?.destroy();
    this.strike?.destroy();
    this.door?.destroy();
    this.sounds?.close();
    this.cutscene =
      this.shatter =
      this.strike =
      this.door =
      this.sounds =
      this.clip =
        null;
    this.cardTarget.classList.remove("fabricate-promo__card--pressed");
    this.launching = false;
  }
}
