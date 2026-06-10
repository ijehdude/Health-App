import type { Exercise } from '@/lib/types';

const ALL_AGES = ['teen', 'youngAdult', 'adult', 'senior'] as const;
const UNDER_55 = ['teen', 'youngAdult', 'adult'] as const;

export const EXERCISES: Exercise[] = [
  {
    id: 'brisk-walking',
    name: 'Brisk Walking',
    description:
      'Walk at a pace where you can talk but not sing. A low-impact cardio staple that raises heart rate, supports fat metabolism and is gentle on joints.',
    type: 'cardio',
    muscles: ['legs', 'glutes', 'core'],
    intensity: 'light',
    equipment: 'none',
    durationMinutes: 30,
    svgKey: 'walk',
    ageGroups: [...ALL_AGES],
    modifications: {
      teen: 'Increase the pace or add gentle hills to keep it challenging.',
      senior: 'Use supportive footwear and flat routes; a walking pole adds stability.',
    },
  },
  {
    id: 'jogging',
    name: 'Jogging',
    description:
      'A steady, conversational-pace run. Builds aerobic capacity, burns calories efficiently and improves cardiovascular endurance.',
    type: 'cardio',
    muscles: ['legs', 'glutes', 'core'],
    intensity: 'moderate',
    equipment: 'none',
    durationMinutes: 25,
    svgKey: 'run',
    ageGroups: [...UNDER_55],
    modifications: {
      teen: 'Alternate 3 minutes jogging with 1 minute walking while building stamina.',
    },
  },
  {
    id: 'cycling',
    name: 'Cycling',
    description:
      'Outdoor or stationary cycling at moderate resistance. Excellent low-impact cardio that strengthens quads and improves glucose uptake.',
    type: 'cardio',
    muscles: ['quads', 'hamstrings', 'calves'],
    intensity: 'moderate',
    equipment: 'minimal',
    durationMinutes: 30,
    svgKey: 'cycle',
    ageGroups: [...ALL_AGES],
    modifications: {
      senior: 'Use a stationary or recumbent bike at low resistance for safety and joint comfort.',
    },
  },
  {
    id: 'swimming',
    name: 'Swimming',
    description:
      'Continuous laps mixing strokes. A full-body, zero-impact workout that builds endurance and strength while protecting joints.',
    type: 'cardio',
    muscles: ['full body', 'shoulders', 'back', 'core'],
    intensity: 'moderate',
    equipment: 'minimal',
    durationMinutes: 30,
    svgKey: 'swim',
    ageGroups: [...ALL_AGES],
    modifications: {
      senior: 'Water aerobics or gentle breaststroke; rest between laps as needed.',
    },
  },
  {
    id: 'jump-rope',
    name: 'Jump Rope',
    description:
      'Skipping in short rounds (e.g. 5 × 2 minutes with 1 minute rest). High calorie burn, great for coordination and bone density.',
    type: 'cardio',
    muscles: ['calves', 'shoulders', 'core'],
    intensity: 'vigorous',
    equipment: 'minimal',
    durationMinutes: 15,
    svgKey: 'jump-rope',
    ageGroups: [...UNDER_55],
    modifications: {
      teen: 'Start with basic two-foot bounces before trying alternating steps.',
      adult: 'Land softly on the balls of your feet; jump on a forgiving surface.',
    },
  },
  {
    id: 'hiit-circuit',
    name: 'HIIT Circuit (Tabata)',
    description:
      'Tabata format: 20 seconds all-out effort, 10 seconds rest, 8 rounds per block (burpees, mountain climbers, high knees, squat jumps). Maximises calorie burn in minimal time.',
    type: 'hiit',
    muscles: ['full body'],
    intensity: 'vigorous',
    equipment: 'none',
    durationMinutes: 20,
    svgKey: 'hiit',
    ageGroups: [...UNDER_55],
    modifications: {
      teen: 'Swap burpees for squat thrusts and keep one block only until conditioned.',
      adult: 'Step out instead of jumping if your knees complain; quality over speed.',
    },
  },
  {
    id: 'bodyweight-squats',
    name: 'Bodyweight Squats',
    description:
      'Stand shoulder-width, sit hips back and down until thighs are near parallel, then drive up through the heels. Foundation of lower-body strength.',
    type: 'strength',
    muscles: ['quads', 'glutes', 'hamstrings', 'core'],
    intensity: 'moderate',
    equipment: 'none',
    durationMinutes: 10,
    sets: 3,
    reps: '12–15',
    svgKey: 'squat',
    ageGroups: [...ALL_AGES],
    modifications: {
      senior: 'Squat to a sturdy chair (sit-to-stand) and use the armrests for assistance if needed.',
      teen: 'Master depth and a neutral spine before adding any load.',
    },
  },
  {
    id: 'push-ups',
    name: 'Push-Ups',
    description:
      'Hands under shoulders, body in a straight line, lower chest to just above the floor and press up. Classic upper-body pressing strength.',
    type: 'strength',
    muscles: ['chest', 'triceps', 'shoulders', 'core'],
    intensity: 'moderate',
    equipment: 'none',
    durationMinutes: 8,
    sets: 3,
    reps: '8–12',
    svgKey: 'push-up',
    ageGroups: [...ALL_AGES],
    modifications: {
      senior: 'Do wall push-ups or knee push-ups to reduce load while keeping the movement pattern.',
      teen: 'Knee push-ups are fine while building strength — full range beats high reps.',
    },
  },
  {
    id: 'plank-hold',
    name: 'Plank Hold',
    description:
      'Forearms down, body rigid from head to heels, glutes and abs braced. Builds deep core stability that protects the lower back.',
    type: 'strength',
    muscles: ['core', 'shoulders', 'glutes'],
    intensity: 'moderate',
    equipment: 'none',
    durationMinutes: 6,
    sets: 3,
    reps: '30–60 sec hold',
    svgKey: 'plank',
    ageGroups: [...ALL_AGES],
    modifications: {
      senior: 'Plank against a countertop or wall at an incline; 15–20 second holds.',
    },
  },
  {
    id: 'reverse-lunges',
    name: 'Reverse Lunges',
    description:
      'Step one foot back, lower until both knees reach ~90°, push through the front heel to return. Easier on the knees than forward lunges.',
    type: 'strength',
    muscles: ['quads', 'glutes', 'hamstrings'],
    intensity: 'moderate',
    equipment: 'none',
    durationMinutes: 10,
    sets: 3,
    reps: '10 each leg',
    svgKey: 'lunge',
    ageGroups: [...ALL_AGES],
    modifications: {
      senior: 'Hold a wall or chair back for balance and shorten the step.',
    },
  },
  {
    id: 'dumbbell-row',
    name: 'Dumbbell Row',
    description:
      'Hinge forward with a flat back, pull the dumbbell to your hip, squeeze the shoulder blade, lower with control. Builds a strong back and posture.',
    type: 'strength',
    muscles: ['lats', 'rhomboids', 'biceps', 'core'],
    intensity: 'moderate',
    equipment: 'gym',
    durationMinutes: 12,
    sets: 3,
    reps: '10–12 each arm',
    svgKey: 'row',
    ageGroups: [...ALL_AGES],
    modifications: {
      senior: 'Use a light dumbbell with one hand braced on a bench for full support.',
      teen: 'Start light and prioritise a neutral spine over weight on the bar.',
    },
  },
  {
    id: 'gentle-yoga',
    name: 'Gentle Yoga Flow',
    description:
      'A slow sequence — cat-cow, downward dog, low lunge, child\'s pose — linking breath to movement. Improves mobility and lowers stress.',
    type: 'flexibility',
    muscles: ['full body', 'hips', 'spine'],
    intensity: 'light',
    equipment: 'none',
    durationMinutes: 20,
    svgKey: 'yoga',
    ageGroups: [...ALL_AGES],
    modifications: {
      senior: 'Use a chair-based flow and avoid deep inversions; move within a pain-free range.',
    },
  },
  {
    id: 'full-body-stretch',
    name: 'Full-Body Stretching',
    description:
      'Hold each major stretch (hamstrings, quads, chest, shoulders, hips, calves) for 30 seconds. Aids recovery and keeps muscles supple.',
    type: 'flexibility',
    muscles: ['full body'],
    intensity: 'light',
    equipment: 'none',
    durationMinutes: 15,
    svgKey: 'stretch',
    ageGroups: [...ALL_AGES],
    modifications: {
      senior: 'Stretch seated or holding a support; never bounce into a stretch.',
    },
  },
  {
    id: 'active-recovery-walk',
    name: 'Active Recovery Walk',
    description:
      'An easy-pace stroll to promote blood flow, ease soreness and gently top up daily movement without taxing recovery.',
    type: 'recovery',
    muscles: ['legs'],
    intensity: 'light',
    equipment: 'none',
    durationMinutes: 20,
    svgKey: 'walk',
    ageGroups: [...ALL_AGES],
    modifications: {
      senior: 'Keep to flat, even ground and bring water.',
    },
  },
  {
    id: 'chair-exercises',
    name: 'Chair Exercises',
    description:
      'Seated marches, leg extensions, seated rows with a band and arm raises — a safe full-body strength routine done from a sturdy chair.',
    type: 'strength',
    muscles: ['legs', 'arms', 'core'],
    intensity: 'light',
    equipment: 'none',
    durationMinutes: 15,
    sets: 2,
    reps: '10–12 per move',
    svgKey: 'chair',
    ageGroups: ['senior'],
    modifications: {
      senior: 'Choose a chair with armrests and keep feet flat on the floor throughout.',
    },
  },
  {
    id: 'balance-stability',
    name: 'Balance & Stability Training',
    description:
      'Single-leg stands, heel-to-toe walking and weight shifts. Improves proprioception and dramatically reduces fall risk.',
    type: 'strength',
    muscles: ['ankles', 'core', 'glutes'],
    intensity: 'light',
    equipment: 'none',
    durationMinutes: 12,
    sets: 2,
    reps: '30 sec per side',
    svgKey: 'balance',
    ageGroups: ['adult', 'senior'],
    modifications: {
      senior: 'Stand within reach of a wall or chair; progress to eyes-closed only when confident.',
    },
  },
];

export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}
