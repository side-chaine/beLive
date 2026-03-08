// beLive Theme System — Theme Validator
// Sprint 7 | Phase 2
// Zod schema for .btheme file validation
// Ensures id, name, version are required; rest is optional

import { z } from 'zod';

const color = z.string().min(3).max(50);

const modeOverridesSchema = z.object({
  accent: color.optional(),
  accentText: color.optional(),
  surfaceBase: color.optional(),
}).strict().optional();

const reactiveSchema = z.object({
  enabled: z.boolean().optional(),
  preset: z.enum(['minimal', 'subtle', 'immersive', 'aggressive', 'concert']).optional(),
  intensity: z.number().min(0).max(1).optional(),
}).optional();

export const bthemeSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),

  primitive: z.record(z.string(), color).optional(),
  semantic: z.record(z.string(), color).optional(),
  component: z.record(z.string(), z.union([color, z.record(z.string(), color)])).optional(),

  modes: z.object({
    concert: modeOverridesSchema,
    karaoke: modeOverridesSchema,
    rehearsal: modeOverridesSchema,
    live: modeOverridesSchema,
  }).optional(),

  typography: z.record(z.string(), z.string()).optional(),
  spacing: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  radii: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  transitions: z.record(z.string(), z.string()).optional(),

  reactive: reactiveSchema,
});

export type BThemeFile = z.infer<typeof bthemeSchema>;

export function validateBTheme(
  data: unknown
): { success: true; theme: BThemeFile } | { success: false; errors: string[] } {
  const result = bthemeSchema.safeParse(data);
  if (result.success) {
    return { success: true, theme: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map(
      i => `${i.path.join('.')}: ${i.message}`
    ),
  };
}
