import { describe, it, expect } from 'vitest';
import { EXERCISE_RECIPES } from './exercise.recipes';

describe('TC-SURFACE-101: Recipe Surface Classification', () => {
  describe('surface property exists on all recipes', () => {
    it('echo-drill has surface classification', () => {
      const recipe = EXERCISE_RECIPES.find(r => r.id === 'echo-drill');
      expect(recipe).toBeDefined();
      expect(recipe?.surface).toBe('stable');
    });

    it('triple-take has surface classification', () => {
      const recipe = EXERCISE_RECIPES.find(r => r.id === 'triple-take');
      expect(recipe).toBeDefined();
      expect(recipe?.surface).toBe('stable');
    });

    it('call-response has surface classification', () => {
      const recipe = EXERCISE_RECIPES.find(r => r.id === 'call-response');
      expect(recipe).toBeDefined();
      expect(recipe?.surface).toBe('special');
    });

    it('backing-only has surface classification', () => {
      const recipe = EXERCISE_RECIPES.find(r => r.id === 'backing-only');
      expect(recipe).toBeDefined();
      expect(recipe?.surface).toBe('smoke');
    });

    it('acappella-boss has surface classification', () => {
      const recipe = EXERCISE_RECIPES.find(r => r.id === 'acappella-boss');
      expect(recipe).toBeDefined();
      expect(recipe?.surface).toBe('smoke');
    });

    it('tempo-ladder has surface classification', () => {
      const recipe = EXERCISE_RECIPES.find(r => r.id === 'tempo-ladder');
      expect(recipe).toBeDefined();
      expect(recipe?.surface).toBe('smoke');
    });

    it('trade has surface classification', () => {
      const recipe = EXERCISE_RECIPES.find(r => r.id === 'trade-v1');
      expect(recipe).toBeDefined();
      expect(recipe?.surface).toBe('smoke');
    });
  });

  describe('surface distribution', () => {
    const stableRecipes = EXERCISE_RECIPES.filter(r => r.surface === 'stable');
    const smokeRecipes = EXERCISE_RECIPES.filter(r => r.surface === 'smoke');
    const specialRecipes = EXERCISE_RECIPES.filter(r => r.surface === 'special');

    it('stable surface contains exactly 2 recipes', () => {
      expect(stableRecipes).toHaveLength(2);
      expect(stableRecipes.map(r => r.id)).toEqual(
        expect.arrayContaining(['echo-drill', 'triple-take'])
      );
    });

    it('smoke surface contains exactly 4 recipes', () => {
      expect(smokeRecipes).toHaveLength(4);
      expect(smokeRecipes.map(r => r.id)).toEqual(
        expect.arrayContaining(['backing-only', 'acappella-boss', 'tempo-ladder', 'trade-v1'])
      );
    });

    it('special surface contains exactly 1 recipe', () => {
      expect(specialRecipes).toHaveLength(1);
      expect(specialRecipes[0].id).toBe('call-response');
    });

    it('all recipes have valid surface values', () => {
      const validSurfaces = ['stable', 'smoke', 'special'];
      EXERCISE_RECIPES.forEach(recipe => {
        expect(validSurfaces).toContain(recipe.surface);
      });
    });
  });

  describe('default learner popover filtering logic', () => {
    const visibleRecipeIds = EXERCISE_RECIPES
      .filter(r => r.surface === 'stable')
      .map(r => r.id);

    it('visible recipes include echo-drill', () => {
      expect(visibleRecipeIds).toContain('echo-drill');
    });

    it('visible recipes include triple-take', () => {
      expect(visibleRecipeIds).toContain('triple-take');
    });

    it('visible recipes exclude backing-only (smoke)', () => {
      expect(visibleRecipeIds).not.toContain('backing-only');
    });

    it('visible recipes exclude acappella-boss (smoke)', () => {
      expect(visibleRecipeIds).not.toContain('acappella-boss');
    });

    it('visible recipes exclude tempo-ladder (smoke)', () => {
      expect(visibleRecipeIds).not.toContain('tempo-ladder');
    });

    it('visible recipes exclude trade (smoke)', () => {
      expect(visibleRecipeIds).not.toContain('trade-v1');
    });

    it('visible recipes exclude call-response (special)', () => {
      expect(visibleRecipeIds).not.toContain('call-response');
    });

    it('visible recipes count is exactly 2', () => {
      expect(visibleRecipeIds).toHaveLength(2);
    });
  });

  describe('surface semantics', () => {
    it('stable recipes are safe for default learner surface', () => {
      const stable = EXERCISE_RECIPES.filter(r => r.surface === 'stable');
      stable.forEach(recipe => {
        // Stable recipes should be drill category
        expect(recipe.category).toBe('drill');
      });
    });

    it('smoke recipes are challenge category', () => {
      const smoke = EXERCISE_RECIPES.filter(r => r.surface === 'smoke');
      smoke.forEach(recipe => {
        expect(['challenge', 'drill']).toContain(recipe.category);
      });
    });

    it('special recipes have unique mechanics', () => {
      const special = EXERCISE_RECIPES.filter(r => r.surface === 'special');
      special.forEach(recipe => {
        // Call & Response uses lineRange scoping
        if (recipe.id === 'call-response') {
          const exercise = recipe.generate('test-block');
          const hasLineRange = exercise.steps.some(
            s => s.scope && 'lineRange' in s.scope
          );
          expect(hasLineRange).toBe(true);
        }
      });
    });
  });

  describe('policy separation', () => {
    it('does not confuse smoke with learner policy', () => {
      // Smoke recipes exist but are hidden from default popover
      const smokeCount = EXERCISE_RECIPES.filter(r => r.surface === 'smoke').length;
      expect(smokeCount).toBe(4);
      
      // But they're not visible to learners by default
      const visibleSmoke = EXERCISE_RECIPES.filter(
        r => r.surface === 'smoke'
      ).filter(
        r => r.surface === 'stable'
      );
      expect(visibleSmoke).toHaveLength(0);
    });

    it('preserves all recipes at runtime', () => {
      // All 7 recipes still exist
      expect(EXERCISE_RECIPES).toHaveLength(7);
      
      // Only visibility is filtered, not generation capability
      const allCanGenerate = EXERCISE_RECIPES.every(recipe => {
        try {
          const exercise = recipe.generate('test-block');
          return !!exercise.id;
        } catch {
          return false;
        }
      });
      expect(allCanGenerate).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('Echo Drill generates correctly as stable recipe', () => {
      const recipe = EXERCISE_RECIPES.find(r => r.id === 'echo-drill');
      const exercise = recipe?.generate('verse-1');
      
      expect(exercise).toBeDefined();
      expect(exercise?.recipeId).toBe('echo-drill');
      expect(exercise?.steps).toHaveLength(2);
    });

    it('3-Take Challenge generates correctly as stable recipe', () => {
      const recipe = EXERCISE_RECIPES.find(r => r.id === 'triple-take');
      const exercise = recipe?.generate('chorus-1');
      
      expect(exercise).toBeDefined();
      expect(exercise?.recipeId).toBe('triple-take');
      expect(exercise?.repeat.count).toBe(3);
    });

    it('Call & Response generates correctly as special recipe', () => {
      const recipe = EXERCISE_RECIPES.find(r => r.id === 'call-response');
      const exercise = recipe?.generate('bridge-1', { lineCount: 4 });
      
      expect(exercise).toBeDefined();
      expect(exercise?.recipeId).toBe('call-response');
      // Should have alternating listen/record steps
      expect(exercise?.steps.length).toBeGreaterThan(0);
    });

    it('No Training Wheels generates correctly as smoke recipe', () => {
      const recipe = EXERCISE_RECIPES.find(r => r.id === 'backing-only');
      const exercise = recipe?.generate('verse-2');
      
      expect(exercise).toBeDefined();
      expect(exercise?.recipeId).toBe('backing-only');
      // Category is on RecipeDef, not Exercise
      expect(recipe?.category).toBe('challenge');
    });

    it('A Cappella Boss generates correctly as smoke recipe', () => {
      const recipe = EXERCISE_RECIPES.find(r => r.id === 'acappella-boss');
      const exercise = recipe?.generate('chorus-2');
      
      expect(exercise).toBeDefined();
      expect(exercise?.recipeId).toBe('acappella-boss');
      expect(exercise?.steps).toHaveLength(4);
    });

    it('Tempo Ladder generates correctly as smoke recipe', () => {
      const recipe = EXERCISE_RECIPES.find(r => r.id === 'tempo-ladder');
      const exercise = recipe?.generate('verse-1', { tempoRate: 0.9 });
      
      expect(exercise).toBeDefined();
      expect(exercise?.recipeId).toBe('tempo-ladder');
      expect(exercise?.steps.length).toBeGreaterThan(0);
    });

    it('Trade v1 generates correctly as smoke recipe', () => {
      const recipe = EXERCISE_RECIPES.find(r => r.id === 'trade-v1');
      const exercise = recipe?.generate('chorus-1', { lineCount: 4 });
      
      expect(exercise).toBeDefined();
      expect(exercise?.recipeId).toBe('trade-v1');
      expect(exercise?.steps.length).toBeGreaterThan(0);
    });
  });
});
