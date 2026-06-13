import type { ExerciseModality, ExerciseType, SvgKey } from './types';

/**
 * Presentation-only mapping: picks a stick-figure illustration (and the
 * exercise "type" that colours it) for a logged exercise modality, so logged
 * and parsed sessions can reuse the existing <ExerciseSVG> icon tiles. This
 * does not affect any stored data.
 */
const MODALITY_SVG: Record<ExerciseModality, SvgKey> = {
  run: 'run',
  bike: 'cycle',
  swim: 'swim',
  walk: 'walk',
  row: 'row',
  strength: 'squat',
  cardio: 'jump-rope',
  hiit: 'hiit',
  yoga: 'yoga',
  other: 'stretch',
};

const MODALITY_TYPE: Record<ExerciseModality, ExerciseType> = {
  run: 'cardio',
  bike: 'cardio',
  swim: 'cardio',
  walk: 'cardio',
  row: 'cardio',
  cardio: 'cardio',
  strength: 'strength',
  hiit: 'hiit',
  yoga: 'flexibility',
  other: 'recovery',
};

export function exerciseIcon(modality: ExerciseModality): { svgKey: SvgKey; type: ExerciseType } {
  return { svgKey: MODALITY_SVG[modality], type: MODALITY_TYPE[modality] };
}
