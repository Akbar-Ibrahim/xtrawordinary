export function isCompleteTargetSet(completedCount: number, targetCount: number): boolean {
  return targetCount > 0 && completedCount >= targetCount;
}
