import { Controller } from "@hotwired/stimulus";

// Shows and hides the home leaderboard. Lives on the event status box, since
// the toggle sits in the clock row while the list sits under the rope. The
// slide and height animation are CSS keyed off data-open on the box.
export default class extends Controller {
  static targets = ["toggle"];

  toggle() {
    const open = this.element.toggleAttribute("data-open");
    this.toggleTarget.setAttribute("aria-expanded", String(open));
  }
}
