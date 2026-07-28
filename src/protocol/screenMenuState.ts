export function normalizeStmMenuIndex(
  value: number | undefined,
  itemsCount?: number,
): number | undefined {
  if (value === undefined) return undefined;

  const selectedIndex = clampByte(value);
  if (itemsCount === undefined) return selectedIndex;

  const count = clampByte(itemsCount);
  return count > 0 ? Math.min(selectedIndex, count - 1) : selectedIndex;
}

export function resolveVisibleMenuWindow(
  selectedIndex: number | undefined,
  itemsCount: number,
  requestedFirstVisibleIndex?: number,
  pageSize = 3,
): { firstVisibleIndex: number; selectedSlot: number | null } {
  const count = Math.max(0, Math.trunc(itemsCount));
  const normalizedPageSize = Math.max(1, Math.trunc(pageSize));
  const selected = selectedIndex === undefined || count === 0
    ? null
    : Math.min(Math.max(0, Math.trunc(selectedIndex)), count - 1);
  const firstVisibleIndex = requestedFirstVisibleIndex === undefined
    ? selected === null
      ? 0
      : Math.floor(selected / normalizedPageSize) * normalizedPageSize
    : Math.min(
        Math.max(0, Math.trunc(requestedFirstVisibleIndex)),
        Math.max(0, count - 1),
      );
  const selectedSlot = selected !== null &&
      selected >= firstVisibleIndex &&
      selected < firstVisibleIndex + normalizedPageSize
    ? selected - firstVisibleIndex
    : null;

  return { firstVisibleIndex, selectedSlot };
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(0xff, Math.trunc(value)));
}
