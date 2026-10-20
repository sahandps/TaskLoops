export const DEFAULT_SLOT_HEIGHT = 24;
export const MIN_SLOT_HEIGHT = 12;
export const MAX_SLOT_HEIGHT = 80;

export function slotHeight(value: number): number {
	return Number.isFinite(value)
		? Math.max(MIN_SLOT_HEIGHT, Math.min(MAX_SLOT_HEIGHT, Math.round(value)))
		: DEFAULT_SLOT_HEIGHT;
}
/** Moving upward magnifies time; bounds keep labels and event handles usable. */
export function draggedSlotHeight(initial: number, deltaY: number): number {
	return slotHeight(initial * Math.exp(Math.max(-8, Math.min(8, -deltaY / 180))));
}
export function zoomedScroll(
	anchorSlots: number,
	size: number,
	header: number,
	screenOffset: number,
): number {
	return Math.max(0, header + anchorSlots * size - screenOffset);
}
