import { create } from 'zustand';

export type SessionConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

interface RehearsalSessionState {
  role: 'teacher' | 'student' | null;
  roomId: string | null;
  connectionState: SessionConnectionState;
  remoteStream: MediaStream | null;
  clockOffset: number;
  rtt: number;
  isResyncing: boolean;
  requiresUserInteraction: boolean;

  setRole: (role: 'teacher' | 'student', roomId: string) => void;
  setConnectionState: (s: SessionConnectionState) => void;
  setRemoteStream: (s: MediaStream | null) => void;
  setClockSync: (offset: number, rtt: number) => void;
  setResyncing: (v: boolean) => void;
  setRequiresUserInteraction: (v: boolean) => void;
  reset: () => void;
}

const initial = {
  role: null as 'teacher' | 'student' | null,
  roomId: null as string | null,
  connectionState: 'idle' as SessionConnectionState,
  remoteStream: null as MediaStream | null,
  clockOffset: 0,
  rtt: 0,
  isResyncing: false,
  requiresUserInteraction: false,
};

export const useRehearsalSessionStore = create<RehearsalSessionState>((set) => ({
  ...initial,
  setRole: (role, roomId) => set({ role, roomId }),
  setConnectionState: (connectionState) => set({ connectionState }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  setClockSync: (clockOffset, rtt) => set({ clockOffset, rtt }),
  setResyncing: (isResyncing) => set({ isResyncing }),
  setRequiresUserInteraction: (requiresUserInteraction) => set({ requiresUserInteraction }),
  reset: () => set(initial),
}));
