/** In-app Eisenhower panel. Data comes from Action Engine / HTTP — this file only renders. */

import {
  MATRIX_QUADS,
  QUAD_META,
  itemTitle,
  normalizeEisItems,
  type EisDoc,
  type EisItem,
  type EisQuad,
} from "../api/eisenhower.ts";

export const EISENHOWER_PANEL_PHASE = "p5";

export interface MatrixHandlers {
  onMove(id: string, quad: EisQuad): void;
  onTrash(id: string): void;
  onUndo(): void;
  onClose(): void;
}

export interface UndoHint {
  id: string;
  prevQuad: string;
}

export class EisenhowerPanel {
  private host: HTMLElement;
  private handlers: MatrixHandlers;
  private doc: EisDoc = { items: [] };
  private undo: UndoHint | null = null;

  constructor(host: HTMLElement, handlers: MatrixHandlers) {
    this.host = host;
    this.handlers = handlers;
    this.host.addEventListener("dragover", (ev) => {
      const zone = (ev.target as HTMLElement).closest("[data-quad]");
      if (!zone) return;
      ev.preventDefault();
      zone.classList.add("drag");
    });
    this.host.addEventListener("dragleave", (ev) => {
      const zone = (ev.target as HTMLElement).closest("[data-quad]");
      if (zone) zone.classList.remove("drag");
    });
    this.host.addEventListener("drop", (ev) => {
      const zone = (ev.target as HTMLElement).closest("[data-quad]");
      if (!zone) return;
      ev.preventDefault();
      zone.classList.remove("drag");
      const id = ev.dataTransfer?.getData("text/plain") || "";
      const quad = zone.getAttribute("data-quad") || "";
      if (!id || !quad) return;
      if (quad === "trash") this.handlers.onTrash(id);
      else this.handlers.onMove(id, quad as EisQuad);
    });
    this.host.addEventListener("click", (ev) => {
      const t = (ev.target as HTMLElement).closest("[data-matrix]") as HTMLElement | null;
      if (!t) return;
      const act = t.getAttribute("data-matrix");
      if (act === "close") this.handlers.onClose();
      if (act === "undo") this.handlers.onUndo();
      if (act === "trash") {
        const id = t.getAttribute("data-id") || "";
        if (id) this.handlers.onTrash(id);
      }
    });
  }

  show(doc: EisDoc): void {
    this.doc = doc;
    this.host.hidden = false;
    this.paint();
  }

  hide(): void {
    this.host.hidden = true;
    this.undo = null;
  }

  get visible(): boolean {
    return !this.host.hidden;
  }

  setDoc(doc: EisDoc): void {
    this.doc = doc;
    this.paint();
  }

  setUndo(hint: UndoHint | null): void {
    this.undo = hint;
    this.paint();
  }

  private paint(): void {
    const items = normalizeEisItems(this.doc.items);
    const matrixCells = MATRIX_QUADS.map((quad) => cell(items, quad)).join("");
    const extraCells = (["inbox", "trash"] as EisQuad[]).map((quad) => cell(items, quad, true)).join("");
    const undo = this.undo
      ? `<div class="undo-bar"><span>تراش ناعم — بدون مسح نهائي</span><button type="button" data-matrix="undo">تراجع</button></div>`
      : `<p class="hint">سحب البطاقة بين الأرباع يحفظ عبر HTTP. التراش ناعم.</p>`;
    this.host.innerHTML = `
      <header class="matrix-head">
        <p class="composer-title">مصفوفة أيزنهاور</p>
        <button type="button" data-matrix="close">إغلاق</button>
      </header>
      <div class="matrix-grid">${matrixCells}</div>
      <div class="matrix-extra">${extraCells}</div>
      ${undo}
    `;
    this.host.querySelectorAll<HTMLElement>(".eis-card[draggable]").forEach((cardEl) => {
      cardEl.addEventListener("dragstart", (ev) => {
        ev.dataTransfer?.setData("text/plain", cardEl.getAttribute("data-id") || "");
      });
    });
  }
}

function cell(items: EisItem[], quad: EisQuad, extra = false): string {
  const list = items.filter((i) => (i.quad || "inbox") === quad);
  const meta = QUAD_META[quad];
  return `<section class="q ${quad}${extra ? " extra" : ""}" data-quad="${quad}">
    <header class="q-head"><span>${meta.ar}</span><small>${meta.axis}</small><b>${list.length}</b></header>
    <div class="q-list">${list.map((it) => card(it, quad)).join("") || `<p class="empty">فارغ</p>`}</div>
  </section>`;
}

function card(it: EisItem, quad: EisQuad): string {
  const id = String(it.id || "");
  const title = itemTitle(it);
  const trashBtn =
    quad === "trash"
      ? ""
      : `<button type="button" class="icon-trash" data-matrix="trash" data-id="${esc(id)}" title="تراش ناعم">⌫</button>`;
  return `<article class="eis-card" draggable="true" data-id="${esc(id)}">
    <span>${esc(title)}</span>${trashBtn}
  </article>`;
}

function esc(s: string): string {
  return s.replace(/[&<>"'`]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" })[c] || c);
}
