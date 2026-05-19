export interface CoverArtTheme {
  coverUrl: string;
  primary: string;
  secondary: string;
  accent: string;
  isDark: boolean;
  text: string;
}

export const DEFAULT_COVER_THEME: CoverArtTheme = {
  coverUrl: '',
  primary: '#6366f1',
  secondary: '#3b82f6',
  accent: '#f59e0b',
  isDark: true,
  text: '#ffffff',
};
