/**
 * Upload Actions — isolation layer for legacy catalogV2 calls
 * F29: All React components call these instead of window.catalogV2 directly
 * F30: Replace internals with React-native upload logic
 * F58: Partial reroute to upload.service.ts
 */

import {
  resetUploadSession as resetUploadSessionSvc,
  handleFileSelect as handleFileSelectSvc,
  clearFile as clearFileSvc,
  saveTrack as saveTrackSvc,
  handleZipFileSelect as handleZipFileSelectSvc,
} from './upload.service';

export function resetUploadSession(): void {
  resetUploadSessionSvc();
}

export function handleFileSelect(type: string, file: File, _fakeCell: HTMLElement): void {
  void handleFileSelectSvc(type as any, file, false);
}

export function clearFile(type: string): void {
  clearFileSvc(type as any);
}

export async function saveTrack(): Promise<void> {
  return saveTrackSvc();
}

export function cancelUpload(): void {
  resetUploadSessionSvc();
}

export function handleZipFileSelect(file: File): void {
  void handleZipFileSelectSvc(file);
}
