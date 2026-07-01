/**
 * Force simulation (d3-force style integration, no dependency).
 *
 * Every tick, forces accumulate into velocities scaled by `alpha`, positions
 * integrate, then damping is applied:
 *
 *   v += F * alpha;  x += v;  v *= damping
 *
 * Forces: pairwise many-body repulsion (+ hard collision separation in the
 * same O(n²) pass — fine for the target 300–800 nodes), Hooke springs on
 * links, and a weak pull toward `center`.
 *
 * Fixed nodes (`fx`/`fy` set — pinned or mid-drag) receive no forces and do
 * not move, but still exert repulsion and spring tension on their neighbours,
 * so they behave as immovable anchors.
 */

import type { GraphLink, GraphNode, GraphParams } from "./types";

/** Simulation sleeps at or below this alpha. */
export const ALPHA_MIN = 0.02;
/** Multiplicative cooling per tick. */
export const ALPHA_DECAY = 0.98;

const MAX_VELOCITY = 60;
/** Repulsion distance floor — avoids force blow-ups when nodes overlap. */
const MIN_DIST2 = 64;

export class Simulation {
  nodes: GraphNode[] = [];
  links: GraphLink[] = [];
  alpha = 0;
  center = { x: 0, y: 0 };
  params: GraphParams;

  constructor(params: GraphParams) {
    this.params = params;
  }

  get active(): boolean {
    return this.alpha > ALPHA_MIN;
  }

  /** Re-energize so the layout re-settles after a change. */
  reheat(alpha = 1): void {
    this.alpha = Math.max(this.alpha, alpha);
  }

  sleep(): void {
    this.alpha = 0;
  }

  /** Advance one frame. Returns false (and does nothing) when asleep. */
  tick(): boolean {
    if (!this.active || this.nodes.length === 0) return false;
    const { repel, linkDistance, linkStrength, damping, center, speed } =
      this.params;
    const a = this.alpha * speed;
    const nodes = this.nodes;
    const n = nodes.length;

    // Many-body repulsion + collision, one pairwise pass.
    for (let i = 0; i < n; i++) {
      const A = nodes[i];
      const freeA = A.fx === null;
      for (let j = i + 1; j < n; j++) {
        const B = nodes[j];
        let dx = B.x - A.x;
        let dy = B.y - A.y;
        let d2 = dx * dx + dy * dy;
        if (d2 === 0) {
          // Coincident: separate deterministically (no RNG, replay-stable).
          dx = (j - i) * 0.5;
          dy = 0.5;
          d2 = dx * dx + dy * dy;
        }
        const d = Math.sqrt(d2);
        const w = (repel * a) / Math.max(d2, MIN_DIST2);
        const fx = dx * w;
        const fy = dy * w;
        const freeB = B.fx === null;
        if (freeA) {
          A.vx -= fx;
          A.vy -= fy;
        }
        if (freeB) {
          B.vx += fx;
          B.vy += fy;
        }

        // Collision: hard positional separation when circles overlap.
        const minD = A.r + B.r + 2;
        if (d < minD) {
          const push = ((minD - d) / d) * 0.5;
          const px = dx * push;
          const py = dy * push;
          if (freeA && freeB) {
            A.x -= px;
            A.y -= py;
            B.x += px;
            B.y += py;
          } else if (freeA) {
            A.x -= px * 2;
            A.y -= py * 2;
          } else if (freeB) {
            B.x += px * 2;
            B.y += py * 2;
          }
        }
      }
    }

    // Springs (Hooke): pull link endpoints toward the resting length.
    for (const link of this.links) {
      const S = link.source;
      const T = link.target;
      const dx = T.x - S.x;
      const dy = T.y - S.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = ((d - linkDistance) / d) * linkStrength * a * 0.5;
      const fx = dx * f;
      const fy = dy * f;
      if (S.fx === null) {
        S.vx += fx;
        S.vy += fy;
      }
      if (T.fx === null) {
        T.vx -= fx;
        T.vy -= fy;
      }
    }

    // Center pull + integration + damping.
    for (const node of this.nodes) {
      if (node.fx !== null) {
        node.x = node.fx;
        node.y = node.fy ?? node.y;
        node.vx = 0;
        node.vy = 0;
        continue;
      }
      node.vx += (this.center.x - node.x) * center * a;
      node.vy += (this.center.y - node.y) * center * a;
      node.vx = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, node.vx));
      node.vy = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, node.vy));
      node.x += node.vx;
      node.y += node.vy;
      node.vx *= damping;
      node.vy *= damping;
    }

    this.alpha *= ALPHA_DECAY;
    return true;
  }
}
