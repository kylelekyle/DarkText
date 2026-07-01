/**
 * Core data model for the force-directed graph view.
 * Positions are world coordinates; the camera maps world → screen.
 */

import type { ChapterSection } from "$lib/types";

export type GraphSection = ChapterSection;

/** What the host supplies to build/reconcile the graph. */
export interface GraphNodeInput {
  id: string;
  label: string;
  section: GraphSection;
  /** Seed position, used only when the node is new to the view. */
  x: number;
  y: number;
  pinned: boolean;
}

export interface GraphLinkInput {
  id: string;
  sourceId: string;
  targetId: string;
}

/** Live simulation node (mutated in place every tick). */
export interface GraphNode {
  id: string;
  label: string;
  section: GraphSection;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Fixed position while pinned or dragged; null = free. */
  fx: number | null;
  fy: number | null;
  pinned: boolean;
  degree: number;
  /** Render radius, derived from degree. */
  r: number;
  /** Animation timestamps (ms epoch); 0 = inactive. */
  pulseAt: number;
  popAt: number;
}

export interface GraphLink {
  id: string;
  source: GraphNode;
  target: GraphNode;
  /** Creation timestamp for the grow-in animation; 0 = no animation. */
  bornAt: number;
}

export interface GraphParams {
  /** Many-body repulsion strength (d3-style magnitude). */
  repel: number;
  /** Spring resting length. */
  linkDistance: number;
  /** Spring stiffness. */
  linkStrength: number;
  /** Velocity retained per frame (0.85–0.95 recommended). */
  damping: number;
  /** Pull toward the graph center. */
  center: number;
  /** Global simulation speed / alpha multiplier. */
  speed: number;
  showLabels: boolean;
}

export const DEFAULT_PARAMS: GraphParams = {
  repel: 60,
  linkDistance: 100,
  linkStrength: 0.7,
  damping: 0.9,
  center: 0.03,
  speed: 1,
  showLabels: true,
};

export const PARAM_RANGES = {
  repel: { min: 10, max: 200, step: 5 },
  linkDistance: { min: 30, max: 300, step: 5 },
  linkStrength: { min: 0.1, max: 1.5, step: 0.05 },
  damping: { min: 0.8, max: 0.97, step: 0.01 },
  center: { min: 0, max: 0.12, step: 0.005 },
  speed: { min: 0.2, max: 2, step: 0.1 },
} as const;

export type NumericParam = keyof typeof PARAM_RANGES;

export function clampParam(key: NumericParam, value: number): number {
  const r = PARAM_RANGES[key];
  if (Number.isNaN(value)) return DEFAULT_PARAMS[key];
  return Math.max(r.min, Math.min(r.max, value));
}

/** Node radius grows gently with connectivity. */
export function nodeRadius(degree: number): number {
  return 5 + Math.min(7, Math.sqrt(degree) * 1.8);
}

/**
 * Deterministic golden-angle spiral for seeding nodes that have no saved
 * position (no RNG — layouts are reproducible).
 */
export function seedPosition(
  index: number,
  cx = 0,
  cy = 0,
): { x: number; y: number } {
  const r = 55 * Math.sqrt(index + 1);
  const theta = index * 2.39996; // golden angle
  return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) };
}
