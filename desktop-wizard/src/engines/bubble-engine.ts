export type BubbleKind = "speech" | "thought" | "alert";

export interface BubbleRequest {
  kind: BubbleKind;
  text: string;
  dir?: "rtl" | "ltr";
  lang?: string;
  ms?: number;
}

export interface BubbleView {
  kind: BubbleKind;
  text: string;
  dir: "rtl" | "ltr";
  lang: string;
  visible: boolean;
}

/**
 * RTL-capable speech / thought / alert bubbles.
 * Layout only — no AQHub calls.
 */
export class BubbleEngine {
  current: BubbleView | null = null;
  private hideAt = 0;

  show(req: BubbleRequest, nowMs = Date.now()): BubbleView {
    const text = req.text.trim().slice(0, 280);
    this.current = {
      kind: req.kind,
      text,
      dir: req.dir || "rtl",
      lang: req.lang || "ar",
      visible: text.length > 0,
    };
    const life = req.ms === 0 ? Number.POSITIVE_INFINITY : (req.ms ?? (req.kind === "alert" ? 8000 : 5000));
    this.hideAt = nowMs + life;
    return this.current;
  }

  tick(nowMs = Date.now()): BubbleView | null {
    if (this.current && this.current.visible && nowMs >= this.hideAt) {
      this.current = { ...this.current, visible: false };
    }
    return this.current;
  }

  hide(): void {
    if (this.current) this.current = { ...this.current, visible: false };
  }

  apply(el: HTMLElement, textEl: HTMLElement): void {
    const b = this.current;
    if (!b || !b.visible) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.dataset.kind = b.kind;
    el.setAttribute("dir", b.dir);
    el.setAttribute("lang", b.lang);
    el.style.direction = b.dir;
    el.style.textAlign = b.dir === "rtl" ? "right" : "left";
    textEl.textContent = b.text;
  }
}
