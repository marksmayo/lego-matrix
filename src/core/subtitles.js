/**
 * Dialogue overlay. Voice-over is italic green (we're listening in on a call,
 * "as though we were on a third line"); in-scene dialogue is white.
 */
export class Subtitles {
  constructor(el, lines, onLine = null) {
    this.onLine = onLine;
    this.el = el;
    this.lines = [...lines].sort((a, b) => a.t - b.t);
    this.node = document.createElement('div');
    this.node.className = 'line';
    this.el.appendChild(this.node);
    this.current = null;
  }

  /** @param {number} t global seconds */
  update(t) {
    let active = null;
    for (const l of this.lines) {
      if (t >= l.t && t < l.t + (l.dur ?? 2)) active = l;
      if (l.t > t) break;
    }
    if (active === this.current) return;
    const fresh = active && (!this.current || active !== this.current);
    this.current = active;
    // Fire on the frame a line comes up, so it can be performed as well as
    // printed. `t - active.t` lets the caller ignore lines it has scrubbed
    // into halfway through.
    if (fresh) this.onLine?.(active, t - active.t);
    if (!active) {
      this.node.classList.remove('show');
      return;
    }
    const style = active.style || 'vo';
    this.node.className = `line show ${style}`;
    this.node.innerHTML = active.who
      ? `<span class="who">${active.who}</span>${escapeHtml(active.text)}`
      : escapeHtml(active.text);
  }

  clear() {
    this.current = null;
    this.node.classList.remove('show');
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
