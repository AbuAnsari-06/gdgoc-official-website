/* ==================================================================
   RURU BUS — one-way, frame-rate-cheap channel from the droid rig to
   the page systems that need to know where it is (the reactive
   typography and the particle wake in SpaceBackground).

   The rig publishes once per animation frame; subscribers do O(1)
   work. Nothing here touches the DOM, so it stays trivially testable
   and can never cause a React render.
   ================================================================== */

export interface RobotPos {
  /** Ground-contact point, in the hero section's own pixel space. */
  x: number;
  y: number;
  /** Rendered ball radius at the current depth, in the same space. */
  r: number;
  /** Current ground speed in px/s (0 while idle). */
  speed: number;
  /** True during the one-time roam cinematic. */
  roaming: boolean;
}

type Sub = (p: RobotPos) => void;

const subs = new Set<Sub>();

export function publishRobot(p: RobotPos): void {
  for (const fn of subs) fn(p);
}

export function subscribeRobot(fn: Sub): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
