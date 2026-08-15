import {Component} from '@angular/core';

/** The lift each bear is grinding out, which picks the arm rig and animation. */
type Exercise = 'curl'|'press'|'squat'|'raise';

/** The art on a bear's belly. */
type Badge = 'heart'|'star'|'rainbow'|'dumbbell';

interface GymBear {
  exercise: Exercise;
  badge: Badge;
  /** Main fur color. */
  fur: string;
  /** Lighter tummy, muzzle and inner ear color. */
  tummy: string;
  /** Where the bear stands, in percent of the gym. */
  left: number;
  top: number;
  /** Size multiplier, where 1 is a full grown bear. */
  scale: number;
  /** Seconds per rep. */
  rep: number;
  /** Offset into the rep so the bears aren't in lockstep. */
  delay: number;
  /** Bears that only get a spot when the screen is wide enough. */
  wideOnly?: boolean;
}

interface Cloud {
  top: number;
  scale: number;
  /** Seconds to drift all the way across. */
  drift: number;
  delay: number;
}

/**
 * A looping cartoon of pastel bears putting in work at the gym. It's pure
 * CSS and SVG, sits behind the page as a background and never takes clicks.
 */
@Component({
  selector: 'app-care-bear-gym',
  templateUrl: './care-bear-gym.component.html',
  styleUrls: ['./care-bear-gym.component.scss'],
})
export class CareBearGymComponent {
  readonly bears: GymBear[] = [
    {
      exercise: 'curl',
      badge: 'heart',
      fur: '#ff9ec4',
      tummy: '#fff0f6',
      left: 6,
      top: 52,
      scale: 1,
      rep: 2.4,
      delay: 0,
    },
    {
      exercise: 'press',
      badge: 'star',
      fur: '#7ec8f2',
      tummy: '#eefaff',
      left: 26,
      top: 34,
      scale: 0.82,
      rep: 3.1,
      delay: -1.4,
    },
    {
      exercise: 'squat',
      badge: 'rainbow',
      fur: '#ffd166',
      tummy: '#fff8e6',
      left: 45,
      top: 58,
      scale: 1.06,
      rep: 3.6,
      delay: -0.7,
    },
    {
      exercise: 'raise',
      badge: 'dumbbell',
      fur: '#b6a4e8',
      tummy: '#f4f0ff',
      left: 68,
      top: 30,
      scale: 0.78,
      rep: 2.8,
      delay: -2.1,
    },
    {
      exercise: 'curl',
      badge: 'star',
      fur: '#8fd9a8',
      tummy: '#eefaf1',
      left: 82,
      top: 62,
      scale: 0.95,
      rep: 2.1,
      delay: -1.1,
    },
    {
      exercise: 'press',
      badge: 'heart',
      fur: '#ff8f6b',
      tummy: '#fff2ec',
      left: 14,
      top: 17,
      scale: 0.62,
      rep: 2.6,
      delay: -0.4,
      wideOnly: true,
    },
    {
      exercise: 'squat',
      badge: 'dumbbell',
      fur: '#f2a4dd',
      tummy: '#fdf0fa',
      left: 55,
      top: 15,
      scale: 0.58,
      rep: 3.3,
      delay: -1.9,
      wideOnly: true,
    },
    {
      exercise: 'raise',
      badge: 'rainbow',
      fur: '#6fd6d1',
      tummy: '#ecfbfa',
      left: 88,
      top: 18,
      scale: 0.6,
      rep: 2.9,
      delay: -0.9,
      wideOnly: true,
    },
  ];

  readonly clouds: Cloud[] = [
    {top: 6, scale: 1, drift: 64, delay: 0},
    {top: 22, scale: 0.7, drift: 88, delay: -30},
    {top: 44, scale: 1.2, drift: 104, delay: -60},
    {top: 68, scale: 0.85, drift: 76, delay: -18},
  ];
}
