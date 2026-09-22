/**
 * P2+ stub — Follow My Work (poll board/Eisenhower, highlight active task).
 * Will use GET /api/tasks and GET /api/eisenhower adapters, not a second store.
 */
export const FOLLOW_MY_WORK_PHASE = "later";
export function isFollowMyWorkAvailable(): boolean {
  return false;
}
