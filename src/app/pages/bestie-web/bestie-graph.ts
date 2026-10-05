import {Backblast} from 'types';

/**
 * A PAX and the HIM they've posted with the most. Mirrors the "Bestie"
 * calculation on the PAX page so the web agrees with every profile.
 */
export interface BestieRecord {
  key: string;   // lowercase identity
  name: string;  // raw name as it appears in the backblasts
  posts: number;
  bestie: string;  // key of the PAX they've posted with the most
  bestieCount: number;
}

export interface BestieNode {
  key: string;
  name: string;
  posts: number;
  bestie: string;
  bestieCount: number;
  mutual: boolean;     // their bestie's bestie is them
  admirers: string[];  // keys of PAX who call this HIM their bestie
  web: number;         // index into BestieGraph.webs
  index: number;       // position in BestieGraph.nodes
  radius: number;

  // layout state
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number|null;  // pinned while dragging
  fy: number|null;
}

export interface BestieEdge {
  source: BestieNode;  // points at...
  target: BestieNode;  // ...their bestie
  count: number;
  mutual: boolean;
}

/** One connected cluster of besties. */
export interface BestieWeb {
  id: number;
  nodes: BestieNode[];
  x: number;  // where the layout gathers this web
  y: number;
}

export interface BestieGraph {
  nodes: BestieNode[];
  edges: BestieEdge[];
  webs: BestieWeb[];  // biggest first
  nodeMap: Map<string, BestieNode>;
}

/**
 * Works out everyone's bestie from the backblasts. Ties go to whoever was
 * seen first in the (date descending) data, the same way the PAX page's
 * stable sort resolves them.
 */
export function computeBesties(backblasts: Backblast[]):
    Map<string, BestieRecord> {
  const posts = new Map<string, number>();
  const names = new Map<string, string>();
  const coPosts = new Map<string, Map<string, number>>();

  for (const backblast of backblasts) {
    // dedupe the pax list in case a name was entered twice
    const seen = new Set<string>();
    const pax: string[] = [];
    for (const name of backblast.pax) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      pax.push(key);
      if (!names.has(key)) names.set(key, name);
    }

    for (const key of pax) {
      posts.set(key, (posts.get(key) ?? 0) + 1);

      let counts = coPosts.get(key);
      if (!counts) {
        counts = new Map<string, number>();
        coPosts.set(key, counts);
      }
      for (const other of pax) {
        if (other === key) continue;
        counts.set(other, (counts.get(other) ?? 0) + 1);
      }
    }
  }

  const records = new Map<string, BestieRecord>();
  for (const [key, counts] of coPosts) {
    let bestie = '';
    let bestieCount = 0;
    for (const [other, count] of counts) {
      if (count > bestieCount) {
        bestie = other;
        bestieCount = count;
      }
    }
    // solo posts only, nobody to be besties with
    if (!bestie) continue;

    records.set(key, {
      key,
      name: names.get(key) ?? key,
      posts: posts.get(key) ?? 0,
      bestie,
      bestieCount,
    });
  }
  return records;
}

/**
 * Builds the web for everyone with at least minPosts BDs. A PAX's bestie is
 * always pulled in (and their bestie, and so on) so every HIM on the web has
 * someone to point at.
 */
export function buildBestieGraph(
    records: Map<string, BestieRecord>, minPosts: number): BestieGraph {
  const included = new Set<string>();
  for (const record of records.values()) {
    if (record.posts < minPosts) continue;

    // follow the bestie chain until it lands on someone already on the web
    let key: string|undefined = record.key;
    while (key && !included.has(key)) {
      included.add(key);
      key = records.get(key)?.bestie;
    }
  }

  const nodeMap = new Map<string, BestieNode>();
  for (const key of included) {
    const record = records.get(key);
    if (!record) continue;
    nodeMap.set(key, {
      key,
      name: record.name,
      posts: record.posts,
      bestie: record.bestie,
      bestieCount: record.bestieCount,
      mutual: false,
      admirers: [],
      web: 0,
      index: 0,
      radius: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
    });
  }

  const edges: BestieEdge[] = [];
  for (const node of nodeMap.values()) {
    const target = nodeMap.get(node.bestie);
    if (!target) continue;
    node.mutual = target.bestie === node.key;
    target.admirers.push(node.key);
    edges.push({
      source: node,
      target,
      count: node.bestieCount,
      mutual: node.mutual,
    });
  }

  // connected clusters, ignoring arrow direction
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    let root = key;
    while (parent.get(root) !== root) root = parent.get(root) ?? root;
    // path compression
    let current = key;
    while (parent.get(current) !== root) {
      const next = parent.get(current) ?? root;
      parent.set(current, root);
      current = next;
    }
    return root;
  };
  for (const key of nodeMap.keys()) parent.set(key, key);
  for (const edge of edges) {
    parent.set(find(edge.source.key), find(edge.target.key));
  }

  const websByRoot = new Map<string, BestieNode[]>();
  for (const node of nodeMap.values()) {
    const root = find(node.key);
    const members = websByRoot.get(root) ?? [];
    members.push(node);
    websByRoot.set(root, members);
  }

  const webs: BestieWeb[] =
      Array.from(websByRoot.values())
          .sort((a, b) => b.length - a.length)
          .map((members, id) => ({id, nodes: members, x: 0, y: 0}));

  // pack the webs along a spiral: biggest in the middle, smaller ones out
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  let packedArea = 0;
  webs.forEach((web, i) => {
    const footprint = 14 * Math.sqrt(web.nodes.length) + 20;
    packedArea += Math.PI * footprint * footprint * 2.2;
    const distance = i === 0 ? 0 : Math.sqrt(packedArea / Math.PI);
    web.x = distance * Math.cos(i * goldenAngle);
    web.y = distance * Math.sin(i * goldenAngle);
  });

  const nodes: BestieNode[] = [];
  for (const web of webs) {
    // the most admired HIM in each web gets listed first
    web.nodes.sort(
        (a, b) => (b.admirers.length - a.admirers.length) ||
            a.key.localeCompare(b.key));
    web.nodes.forEach((node, i) => {
      node.web = web.id;
      node.index = nodes.length;
      node.radius = 5 + 2.2 * Math.sqrt(node.admirers.length);

      // phyllotaxis start around the web's own centre
      const radius = 14 * Math.sqrt(0.5 + i);
      node.x = web.x + radius * Math.cos(i * goldenAngle);
      node.y = web.y + radius * Math.sin(i * goldenAngle);
      nodes.push(node);
    });
  }

  return {nodes, edges, webs, nodeMap};
}

/**
 * A small force-directed layout in the spirit of d3-force: springs along
 * bestie arrows, short range repulsion so nobody overlaps, and a gentle pull
 * toward each web's own spot so the clusters stay apart.
 */
export class ForceLayout {
  alpha = 1;

  private readonly alphaMin = 0.001;
  private readonly alphaDecay = 1 - Math.pow(0.001, 1 / 300);
  private readonly velocityDecay = 0.4;

  private readonly chargeStrength = -40;
  private readonly chargeDistance = 120;
  private readonly webStrength = 0.05;
  private readonly centerStrength = 0.004;

  constructor(private readonly graph: BestieGraph) {}

  get active(): boolean {
    return this.alpha >= this.alphaMin;
  }

  /** Wakes the simulation back up, e.g. after someone drags a node. */
  reheat(alpha = 0.3) {
    this.alpha = Math.max(this.alpha, alpha);
  }

  /** Advances the layout one step. Returns false once it has settled. */
  tick(): boolean {
    if (!this.active) return false;
    this.alpha += (0 - this.alpha) * this.alphaDecay;

    this.applyLinks();
    this.applyChargeAndCollide();
    this.applyCenter();

    for (const node of this.graph.nodes) {
      if (node.fx !== null && node.fy !== null) {
        node.x = node.fx;
        node.y = node.fy;
        node.vx = 0;
        node.vy = 0;
        continue;
      }
      node.vx *= 1 - this.velocityDecay;
      node.vy *= 1 - this.velocityDecay;
      node.x += node.vx;
      node.y += node.vy;
    }
    return true;
  }

  /** Runs the layout until it settles or the tick budget runs out. */
  settle(maxTicks: number) {
    for (let i = 0; i < maxTicks && this.tick(); i++) {
    }
  }

  private degree(node: BestieNode): number {
    return node.admirers.length + 1;
  }

  private applyLinks() {
    for (const edge of this.graph.edges) {
      const {source, target} = edge;
      const sourceDegree = this.degree(source);
      const targetDegree = this.degree(target);

      // mutual besties sit closer together
      const distance =
          source.radius + target.radius + (edge.mutual ? 22 : 40);
      const strength = 1 / Math.min(sourceDegree, targetDegree);
      const bias = sourceDegree / (sourceDegree + targetDegree);

      let dx = target.x + target.vx - source.x - source.vx || jitter();
      let dy = target.y + target.vy - source.y - source.vy || jitter();
      let length = Math.sqrt(dx * dx + dy * dy);
      length = (length - distance) / length * this.alpha * strength;
      dx *= length;
      dy *= length;

      target.vx -= dx * bias;
      target.vy -= dy * bias;
      source.vx += dx * (1 - bias);
      source.vy += dy * (1 - bias);
    }
  }

  /**
   * Repulsion between nearby nodes plus a hard push apart when two circles
   * overlap. A uniform grid keeps this close to linear in the node count.
   */
  private applyChargeAndCollide() {
    const cellSize = this.chargeDistance;
    const cells = new Map<number, BestieNode[]>();
    // cells are numbered on a big virtual grid so the key stays a number
    const span = 1 << 16;
    const cellKey = (cx: number, cy: number) =>
        (cx + span / 2) * span + (cy + span / 2);

    for (const node of this.graph.nodes) {
      const key =
          cellKey(Math.floor(node.x / cellSize), Math.floor(node.y / cellSize));
      const bucket = cells.get(key);
      if (bucket) {
        bucket.push(node);
      } else {
        cells.set(key, [node]);
      }
    }

    const maxDistanceSq = this.chargeDistance * this.chargeDistance;

    for (const node of this.graph.nodes) {
      const cx = Math.floor(node.x / cellSize);
      const cy = Math.floor(node.y / cellSize);

      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const bucket = cells.get(cellKey(cx + ox, cy + oy));
          if (!bucket) continue;

          for (const other of bucket) {
            // visit each pair once
            if (other.index <= node.index) continue;

            let dx = other.x - node.x || jitter();
            let dy = other.y - node.y || jitter();
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq > maxDistanceSq) continue;

            const distance = Math.sqrt(distanceSq);
            const minDistance = node.radius + other.radius + 3;

            if (distance < minDistance) {
              // overlapping: shove apart, bigger node moves less
              const overlap = (minDistance - distance) / distance * 0.7;
              const nodeMass = node.radius * node.radius;
              const otherMass = other.radius * other.radius;
              const total = nodeMass + otherMass;
              dx *= overlap;
              dy *= overlap;
              node.vx -= dx * (otherMass / total);
              node.vy -= dy * (otherMass / total);
              other.vx += dx * (nodeMass / total);
              other.vy += dy * (nodeMass / total);
            } else {
              // coulomb-style repulsion that fades with distance
              const weight = this.chargeStrength * this.alpha / distanceSq;
              node.vx += dx * weight;
              node.vy += dy * weight;
              other.vx -= dx * weight;
              other.vy -= dy * weight;
            }
          }
        }
      }
    }
  }

  private applyCenter() {
    const webStrength = this.webStrength * this.alpha;
    const centerStrength = this.centerStrength * this.alpha;
    for (const node of this.graph.nodes) {
      const web = this.graph.webs[node.web];
      if (web) {
        node.vx += (web.x - node.x) * webStrength;
        node.vy += (web.y - node.y) * webStrength;
      }
      node.vx -= node.x * centerStrength;
      node.vy -= node.y * centerStrength;
    }
  }
}

/** Tiny random nudge so two nodes on the exact same spot can separate. */
function jitter(): number {
  return (Math.random() - 0.5) * 1e-6;
}
