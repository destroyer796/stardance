import { Controller } from "@hotwired/stimulus";

// Live countdown to a fixed instant. Ticks every half-minute so the minute
// display stays current; includes days for longer windows and clamps at zero.
// With `seconds` set it ticks every second and reads as a 00:00:00 clock.
export default class extends Controller {
  static values = { resetAt: String, expiredText: String, seconds: Boolean };

  connect() {
    this.render();
    this.timer = setInterval(
      () => this.render(),
      this.secondsValue ? 1_000 : 30_000,
    );
  }

  disconnect() {
    clearInterval(this.timer);
  }

  render() {
    const remaining = new Date(this.resetAtValue).getTime() - Date.now();
    if (remaining <= 0 && this.hasExpiredTextValue) {
      this.element.textContent = this.expiredTextValue;
      clearInterval(this.timer);
      return;
    }

    const secs = Math.max(0, Math.floor(remaining / 1000));
    const totalHours = Math.floor(secs / 3600);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const mins = Math.floor((secs % 3600) / 60);

    if (this.secondsValue) {
      const clock = [hours, mins, secs % 60]
        .map((n) => String(n).padStart(2, "0"))
        .join(":");
      this.element.textContent = days > 0 ? `${days}d ${clock}` : clock;
      return;
    }

    this.element.textContent =
      days > 0 ? `${days}d ${hours}h ${mins}min` : `${hours}h ${mins}min`;
  }
}
