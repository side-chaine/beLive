import { useMarkersStore } from '../stores/markers.store';
import { getActiveLineAtTime } from '../utils/markerUtils';

export function hasMarkers(): boolean {
  const { markers } = useMarkersStore.getState();
  return Array.isArray(markers) && markers.length > 0;
}

export function getActiveLine(currentTime: number): number {
  const { markers } = useMarkersStore.getState();
  return getActiveLineAtTime(markers, currentTime);
}
