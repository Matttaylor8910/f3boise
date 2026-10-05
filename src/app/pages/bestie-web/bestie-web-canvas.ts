import {BestieEdge, BestieGraph, BestieNode, ForceLayout} from './bestie-graph';

export interface WebTheme {
  text: string;
  muted: string;
  background: string;
  primary: string;
}

export interface WebCanvasCallbacks {
  onSelect: (node: BestieNode|null) => void;
}

interface PointerState {
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
  node: BestieNode|null;  // the node being dragged, if any
}

/** Distinct hues so neighbouring webs read as separate clusters. */
const WEB_HUES = [212, 28, 150, 268, 95, 340, 185, 45, 300, 120, 0, 230];

const MIN_SCALE = 0.15;
const MAX_SCALE = 4;
const TAP_SLOP_PX = 6;

/**
 * Draws the bestie web on a canvas and handles pan / zoom / drag / tap.
 * Plain DOM so it stays testable outside Angular.
 */
export class BestieWebCanvas {
  private readonly ctx: CanvasRenderingContext2D;
  private graph: BestieGraph|null = null;
  private layout: ForceLayout|null = null;

  private scale = 1;
  private tx = 0;
  private ty = 0;
  private width = 0;
  private height = 0;

  private selected: BestieNode|null = null;
  private hovered: BestieNode|null = null;
  private focusWeb = -1;
  private readonly related = new Set<string>();  // selected + arrows in/out

  private theme: WebTheme = {
    text: '#000000',
    muted: '#92949c',
    background: '#ffffff',
    primary: '#3880ff',
  };

  private pendingCenter: BestieNode|null = null;
  private avatarUrls = new Map<string, string>();
  private readonly images = new Map<string, HTMLImageElement|null>();

  private readonly pointers = new Map<number, PointerState>();
  private pinchDistance = 0;
  private frame = 0;
  private dirty = true;
  private destroyed = false;
  private resizeObserver?: ResizeObserver;

  private readonly listeners: Array<() => void> = [];

  constructor(
      private readonly canvas: HTMLCanvasElement,
      private readonly callbacks: WebCanvasCallbacks,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    this.ctx = ctx;

    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';

    this.listen('pointerdown', event => this.onPointerDown(event));
    this.listen('pointermove', event => this.onPointerMove(event));
    this.listen('pointerup', event => this.onPointerUp(event));
    this.listen('pointercancel', event => this.onPointerUp(event));
    this.listen('pointerleave', () => this.onPointerLeave());
    this.listen('wheel', event => this.onWheel(event), {passive: false});

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    }
    this.resize();
  }

  destroy() {
    this.destroyed = true;
    this.listeners.forEach(remove => remove());
    this.resizeObserver?.disconnect();
    if (this.frame) cancelAnimationFrame(this.frame);
  }

  setTheme(theme: WebTheme) {
    this.theme = theme;
    this.requestFrame();
  }

  setAvatars(urls: Map<string, string>) {
    this.avatarUrls = urls;
    this.requestFrame();
  }

  /** Loads a new graph, settles most of the layout up front, and fits it. */
  setGraph(graph: BestieGraph) {
    this.graph = graph;
    this.layout = new ForceLayout(graph);
    this.selected = null;
    this.hovered = null;
    this.focusWeb = -1;
    this.related.clear();

    this.layout.settle(120);
    this.fit();
  }

  get selectedNode(): BestieNode|null {
    return this.selected;
  }

  /** Highlights a PAX and their web, optionally centering the view on them. */
  select(key: string|null, center = false) {
    const node = key && this.graph ? this.graph.nodeMap.get(key) ?? null : null;
    this.selected = node;
    this.related.clear();
    this.focusWeb = node ? node.web : -1;

    if (node) {
      this.related.add(node.key);
      this.related.add(node.bestie);
      node.admirers.forEach(admirer => this.related.add(admirer));
      if (center) this.centerOn(node);
    }

    this.callbacks.onSelect(node);
    this.requestFrame();
  }

  /** Zooms so the whole web is visible. */
  fit() {
    if (!this.graph || this.graph.nodes.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of this.graph.nodes) {
      minX = Math.min(minX, node.x - node.radius);
      minY = Math.min(minY, node.y - node.radius);
      maxX = Math.max(maxX, node.x + node.radius);
      maxY = Math.max(maxY, node.y + node.radius);
    }

    const padding = 24;
    const boundsWidth = Math.max(1, maxX - minX);
    const boundsHeight = Math.max(1, maxY - minY);
    const scale = Math.min(
        (this.width - padding * 2) / boundsWidth,
        (this.height - padding * 2) / boundsHeight);
    this.scale = clamp(scale, MIN_SCALE, 1.5);
    this.tx = this.width / 2 - (minX + maxX) / 2 * this.scale;
    this.ty = this.height / 2 - (minY + maxY) / 2 * this.scale;
    this.requestFrame();
  }

  private centerOn(node: BestieNode) {
    if (this.width === 0) {
      // not laid out yet, centre once the canvas gets its size
      this.pendingCenter = node;
      return;
    }
    this.scale = Math.max(this.scale, 1.6);
    this.tx = this.width / 2 - node.x * this.scale;
    this.ty = this.height / 2 - node.y * this.scale;
  }

  // ---------------------------------------------------------------- events

  private listen<K extends keyof HTMLElementEventMap>(
      type: K, handler: (event: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions) {
    this.canvas.addEventListener(type, handler, options);
    this.listeners.push(
        () => this.canvas.removeEventListener(type, handler, options));
  }

  private onPointerDown(event: PointerEvent) {
    event.preventDefault();
    this.canvas.setPointerCapture?.(event.pointerId);

    const node = this.pointers.size === 0 ?
        this.nodeAt(event.offsetX, event.offsetY) :
        null;
    this.pointers.set(event.pointerId, {
      x: event.offsetX,
      y: event.offsetY,
      startX: event.offsetX,
      startY: event.offsetY,
      moved: false,
      node,
    });

    if (node) {
      node.fx = node.x;
      node.fy = node.y;
      this.canvas.style.cursor = 'grabbing';
    }

    if (this.pointers.size === 2) {
      // a second finger turns any drag into a pinch
      for (const pointer of this.pointers.values()) this.releaseNode(pointer);
      this.pinchDistance = this.pointerDistance();
    }
  }

  private onPointerMove(event: PointerEvent) {
    const pointer = this.pointers.get(event.pointerId);

    if (!pointer) {
      // plain mouse hover
      const node = this.nodeAt(event.offsetX, event.offsetY);
      if (node !== this.hovered) {
        this.hovered = node;
        this.canvas.style.cursor = node ? 'pointer' : 'grab';
        this.requestFrame();
      }
      return;
    }

    event.preventDefault();
    const dx = event.offsetX - pointer.x;
    const dy = event.offsetY - pointer.y;
    pointer.x = event.offsetX;
    pointer.y = event.offsetY;
    if (Math.abs(event.offsetX - pointer.startX) > TAP_SLOP_PX ||
        Math.abs(event.offsetY - pointer.startY) > TAP_SLOP_PX) {
      pointer.moved = true;
    }

    if (this.pointers.size >= 2) {
      this.pinch();
    } else if (pointer.node) {
      pointer.node.fx = (event.offsetX - this.tx) / this.scale;
      pointer.node.fy = (event.offsetY - this.ty) / this.scale;
      this.layout?.reheat(0.2);
    } else {
      this.tx += dx;
      this.ty += dy;
    }
    this.requestFrame();
  }

  private onPointerUp(event: PointerEvent) {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;
    this.pointers.delete(event.pointerId);
    this.canvas.releasePointerCapture?.(event.pointerId);

    const tapped = !pointer.moved && this.pointers.size === 0;
    const draggedNode = pointer.node;
    this.releaseNode(pointer);
    this.canvas.style.cursor = 'grab';

    if (tapped) {
      const node = draggedNode ?? this.nodeAt(event.offsetX, event.offsetY);
      this.select(node ? node.key : null);
    }
    this.requestFrame();
  }

  private onPointerLeave() {
    if (this.hovered) {
      this.hovered = null;
      this.requestFrame();
    }
  }

  private onWheel(event: WheelEvent) {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0015);
    this.zoomAt(event.offsetX, event.offsetY, factor);
    this.requestFrame();
  }

  private releaseNode(pointer: PointerState) {
    if (!pointer.node) return;
    pointer.node.fx = null;
    pointer.node.fy = null;
    pointer.node = null;
    this.layout?.reheat(0.2);
  }

  private pointerDistance(): number {
    const [a, b] = Array.from(this.pointers.values());
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private pinch() {
    const [a, b] = Array.from(this.pointers.values());
    if (!a || !b) return;

    const distance = this.pointerDistance();
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    if (this.pinchDistance > 0) {
      this.zoomAt(midX, midY, distance / this.pinchDistance);
    }
    this.pinchDistance = distance;
  }

  private zoomAt(x: number, y: number, factor: number) {
    const next = clamp(this.scale * factor, MIN_SCALE, MAX_SCALE);
    const applied = next / this.scale;
    this.tx = x - (x - this.tx) * applied;
    this.ty = y - (y - this.ty) * applied;
    this.scale = next;
  }

  /** The node under a screen point, if any. */
  private nodeAt(x: number, y: number): BestieNode|null {
    if (!this.graph) return null;

    let best: BestieNode|null = null;
    let bestDistance = Infinity;
    for (const node of this.graph.nodes) {
      const sx = node.x * this.scale + this.tx;
      const sy = node.y * this.scale + this.ty;
      const hit = Math.max(node.radius * this.scale, 6) + 4;
      const distance = Math.hypot(sx - x, sy - y);
      if (distance <= hit && distance < bestDistance) {
        best = node;
        bestDistance = distance;
      }
    }
    return best;
  }

  // -------------------------------------------------------------- drawing

  private resize() {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return;

    const first = this.width === 0;
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    if (first) this.fit();
    if (this.pendingCenter) {
      this.centerOn(this.pendingCenter);
      this.pendingCenter = null;
    }
    this.requestFrame();
  }

  private requestFrame() {
    this.dirty = true;
    if (this.frame || this.destroyed) return;
    this.frame = requestAnimationFrame(() => this.loop());
  }

  private loop() {
    this.frame = 0;
    if (this.destroyed) return;

    const animating = this.layout?.tick() ?? false;
    if (this.dirty || animating) {
      this.dirty = false;
      this.draw();
    }
    if (animating) this.requestFrame();
  }

  private draw() {
    const {ctx, graph} = this;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    if (!graph) return;

    const selecting = this.selected !== null;

    for (const edge of graph.edges) {
      // a mutual pair is one line with two arrowheads, drawn once
      if (edge.mutual && edge.source.key > edge.target.key) continue;
      this.drawEdge(edge, selecting);
    }

    for (const node of graph.nodes) {
      this.drawNode(node, selecting);
    }

    for (const node of graph.nodes) {
      if (this.showLabel(node, selecting)) this.drawLabel(node, selecting);
    }

    if (this.hovered && this.hovered !== this.selected) {
      this.drawTooltip(this.hovered);
    }
  }

  private edgeAlpha(edge: BestieEdge, selecting: boolean): number {
    if (!selecting) return edge.mutual ? 0.85 : 0.45;
    if (edge.source === this.selected || edge.target === this.selected) {
      return 1;
    }
    return edge.source.web === this.focusWeb ? 0.5 : 0.06;
  }

  private nodeAlpha(node: BestieNode, selecting: boolean): number {
    if (!selecting) return 1;
    if (this.related.has(node.key)) return 1;
    return node.web === this.focusWeb ? 0.75 : 0.12;
  }

  private drawEdge(edge: BestieEdge, selecting: boolean) {
    const {ctx} = this;
    const {source, target} = edge;
    const sx = source.x * this.scale + this.tx;
    const sy = source.y * this.scale + this.ty;
    const tx = target.x * this.scale + this.tx;
    const ty = target.y * this.scale + this.ty;

    const dx = tx - sx;
    const dy = ty - sy;
    const length = Math.hypot(dx, dy);
    if (length < 1) return;
    const ux = dx / length;
    const uy = dy / length;

    // start and end at the circle edges, not their centres
    const startX = sx + ux * source.radius * this.scale;
    const startY = sy + uy * source.radius * this.scale;
    const endX = tx - ux * target.radius * this.scale;
    const endY = ty - uy * target.radius * this.scale;

    const direct = selecting &&
        (source === this.selected || target === this.selected);
    const width = clamp(0.8 + Math.log2(edge.count) * 0.45, 0.8, 4) *
        clamp(Math.sqrt(this.scale), 0.6, 1.4);

    ctx.globalAlpha = this.edgeAlpha(edge, selecting);
    ctx.strokeStyle =
        edge.mutual || direct ? this.theme.primary : this.theme.muted;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = direct ? width + 1 : width;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    const head = clamp(5 + width * 1.5, 5, 12);
    this.drawArrowHead(endX, endY, ux, uy, head);
    if (edge.mutual) this.drawArrowHead(startX, startY, -ux, -uy, head);
    ctx.globalAlpha = 1;
  }

  private drawArrowHead(
      x: number, y: number, ux: number, uy: number, size: number) {
    const {ctx} = this;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
        x - ux * size - uy * size * 0.5, y - uy * size + ux * size * 0.5);
    ctx.lineTo(
        x - ux * size + uy * size * 0.5, y - uy * size - ux * size * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  private drawNode(node: BestieNode, selecting: boolean) {
    const {ctx} = this;
    const x = node.x * this.scale + this.tx;
    const y = node.y * this.scale + this.ty;
    const radius = Math.max(node.radius * this.scale, 2.5);
    const isSelected = node === this.selected;
    const isHovered = node === this.hovered;

    ctx.globalAlpha = this.nodeAlpha(node, selecting);
    ctx.fillStyle = webColor(node.web);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    const image = radius >= 11 ? this.imageFor(node) : null;
    if (image) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius - 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
      ctx.restore();
    }

    if (isSelected || isHovered) {
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeStyle = isSelected ? this.theme.primary : this.theme.text;
      ctx.beginPath();
      ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (node.mutual) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = this.theme.background;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private showLabel(node: BestieNode, selecting: boolean): boolean {
    if (node === this.selected || node === this.hovered) return true;
    if (selecting) {
      // only the selected HIM's own circle and the hubs of their web
      if (this.related.has(node.key)) return true;
      return node.web === this.focusWeb && node.radius * this.scale >= 11;
    }
    if (this.scale >= 1.4) return true;
    return node.radius * this.scale >= 9;
  }

  private drawLabel(node: BestieNode, selecting: boolean) {
    const {ctx} = this;
    const x = node.x * this.scale + this.tx;
    const radius = Math.max(node.radius * this.scale, 2.5);
    const y = node.y * this.scale + this.ty + radius + 3;
    const emphasised = node === this.selected || node === this.hovered;

    ctx.globalAlpha = this.nodeAlpha(node, selecting);
    ctx.font = emphasised ? '700 13px sans-serif' : '500 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.theme.background;
    ctx.fillStyle = emphasised ? this.theme.primary : this.theme.text;
    const label = displayName(node.name);
    ctx.strokeText(label, x, y);
    ctx.fillText(label, x, y);
    ctx.globalAlpha = 1;
  }

  private drawTooltip(node: BestieNode) {
    const {ctx} = this;
    const bestie = this.graph?.nodeMap.get(node.bestie);
    const text = `${displayName(node.name)} → ${
        bestie ? displayName(bestie.name) : '?'} · ${node.bestieCount} BD${
        node.bestieCount === 1 ? '' : 's'}`;

    ctx.font = '600 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const padding = 8;
    const textWidth = ctx.measureText(text).width;
    const boxWidth = textWidth + padding * 2;
    const boxHeight = 26;

    const nodeX = node.x * this.scale + this.tx;
    const nodeY = node.y * this.scale + this.ty;
    const radius = Math.max(node.radius * this.scale, 2.5);
    let x = nodeX - boxWidth / 2;
    let y = nodeY - radius - boxHeight - 8;
    x = clamp(x, 4, Math.max(4, this.width - boxWidth - 4));
    if (y < 4) y = nodeY + radius + 8;

    ctx.fillStyle = this.theme.text;
    ctx.globalAlpha = 0.9;
    roundRect(ctx, x, y, boxWidth, boxHeight, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.theme.background;
    ctx.fillText(text, x + padding, y + boxHeight / 2);
  }

  private imageFor(node: BestieNode): HTMLImageElement|null {
    const cached = this.images.get(node.key);
    if (cached !== undefined) {
      const ready = cached && cached.complete && cached.naturalWidth > 0;
      return ready ? cached : null;
    }

    const url = this.avatarUrls.get(node.key);
    if (!url) return null;

    const image = new Image();
    image.onload = () => this.requestFrame();
    image.onerror = () => this.images.set(node.key, null);
    image.src = url;
    this.images.set(node.key, image);
    return null;
  }
}

export function webColor(web: number): string {
  const hue = WEB_HUES[web % WEB_HUES.length];
  return `hsl(${hue}, 62%, 52%)`;
}

/** "camelsBack" / "camels back" / "camels-back" → "Camels Back". */
function displayName(name: string): string {
  const words: string[] = [];
  name.split(/(?=[A-Z])/).forEach(part => {
    part.split(/[-\s]+/).forEach(word => {
      if (word !== '') words.push(word.charAt(0).toUpperCase() + word.slice(1));
    });
  });
  return words.join(' ');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundRect(
    ctx: CanvasRenderingContext2D, x: number, y: number, width: number,
    height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
