// @TC-AVATAR: Avatar Visual Engine — inline SVG preset assets (v3.1)
// silhouette preset: dark minimalist head+shoulders ghost

export const AVATAR_PRESETS = {
  default: {
    id: 'default',
    name: 'Default',
    /** Inline SVG string for avatar body */
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 180" class="av-svg">
  <g class="av-body">
    <!-- Head -->
    <g class="av-head">
      <ellipse cx="60" cy="35" rx="28" ry="30" fill="var(--av-skin, #f5cba7)" stroke="var(--av-outline, #333)" stroke-width="1.5"/>
    </g>
    <!-- Eyes (keep for CSS contract) -->
    <g class="av-eyes">
      <ellipse cx="48" cy="32" rx="4" ry="5" fill="var(--av-eye, #333)" class="av-eye-left"/>
      <ellipse cx="72" cy="32" rx="4" ry="5" fill="var(--av-eye, #333)" class="av-eye-right"/>
    </g>
    <!-- Mouth -->
    <g class="av-mouth">
      <path d="M50,44 Q60,52 70,44" fill="none" stroke="var(--av-mouth, #333)" stroke-width="2" stroke-linecap="round" class="av-mouth-path"/>
    </g>
    <!-- Torso -->
    <g class="av-torso">
      <rect x="35" y="65" width="50" height="55" rx="10" fill="var(--av-skin, #f5cba7)" stroke="var(--av-outline, #333)" stroke-width="1.5"/>
    </g>
    <!-- Left Arm -->
    <g class="av-left-arm">
      <path d="M35,80 Q20,100 25,120" fill="none" stroke="var(--av-skin, #f5cba7)" stroke-width="10" stroke-linecap="round"/>
    </g>
    <!-- Right Arm -->
    <g class="av-right-arm">
      <path d="M85,80 Q100,100 95,120" fill="none" stroke="var(--av-skin, #f5cba7)" stroke-width="10" stroke-linecap="round"/>
    </g>
  </g>
</svg>`,
  },
  silhouette: {
    id: 'silhouette',
    name: 'Silhouette',
    /** Minimalist dark ghost silhouette with CSS contract placeholders */
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 180" class="av-svg">
  <g class="av-body">
    <!-- Head -->
    <ellipse cx="60" cy="32" rx="24" ry="26" fill="rgba(255,255,255,0.12)"/>
    <!-- Shoulders -->
    <path d="M20,68 Q35,58 60,58 Q85,58 100,68 L105,82 Q60,92 15,82 Z" fill="rgba(255,255,255,0.12)"/>
    <!-- CSS contract placeholders (invisible, maintain selectors) -->
    <g class="av-eyes" style="visibility:hidden;opacity:0">
      <ellipse cx="48" cy="32" rx="0.1" ry="0.1"/>
      <ellipse cx="72" cy="32" rx="0.1" ry="0.1"/>
    </g>
    <path class="av-mouth-path" d="M60,44" style="visibility:hidden;opacity:0"/>
  </g>
</svg>`,
  },
} as const;

export type AvatarPresetId = keyof typeof AVATAR_PRESETS;
