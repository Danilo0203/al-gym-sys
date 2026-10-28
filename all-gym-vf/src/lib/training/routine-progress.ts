export function getDayProgress(details: ReadonlyArray<{ id: number }>, completedIds: ReadonlySet<number>) {
  const completed = details.filter((detail) => completedIds.has(detail.id)).length;
  return { completed, total: details.length, isComplete: details.length > 0 && completed === details.length };
}
