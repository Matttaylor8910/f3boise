import {Component, EventEmitter, Input, Output} from '@angular/core';

import {F3Event} from 'src/app/services/f3-api.service';

import {AoDay, AoUpcomingClosure, GroupedAo} from '../../map.page';

/**
 * Right-sidebar panel for a selected AO: closure banner, location block,
 * weekly schedule, and description. Pure display + delegation; the parent
 * owns selection, mutations, and modal state.
 */
@Component({
  selector: 'app-map-ao-detail',
  templateUrl: './ao-detail.component.html',
  styleUrls: ['./ao-detail.component.scss'],
})
export class MapAoDetailComponent {
  /** The currently selected AO. Required. */
  @Input() ao!: GroupedAo;

  /** Upcoming closures for {@link ao} (sorted by date by the parent). */
  @Input() closures: AoUpcomingClosure[] = [];

  /** Pre-resolved location label (AO title fallback applied). */
  @Input() locationLabel = '';

  /** Pre-resolved AO "About" text from the AO org row. */
  @Input() about = '';

  /** Whether the current user can edit shared location records. */
  @Input() canEditLocation = false;

  /** Whether the current user can add/edit weekly events. */
  @Input() canEditSchedule = false;

  /** Click on the back button. */
  @Output() back = new EventEmitter<void>();

  /** User clicked the location name (only emitted when {@link canEditLocation}). */
  @Output() editLocation = new EventEmitter<void>();

  /** User clicked a day row to add/edit a workout. */
  @Output() editDay = new EventEmitter<AoDay>();

  /**
   * Convert F3 API HHMM (or HH:MM with stray :SS) into 12-hour display.
   */
  formatTime(time: string): string {
    if (!time || time.length < 4) return time;
    const p = time.padStart(4, '0');
    const h = parseInt(p.slice(0, 2), 10);
    const mins = p.slice(2);
    return `${h % 12 || 12}:${mins} ${h >= 12 ? 'PM' : 'AM'}`;
  }

  /** Workout type label(s) for schedule row (from `/event` `eventTypes`). */
  dayEventTypeLine(ev: F3Event): string {
    if (!ev.eventTypes?.length) return '';
    return ev.eventTypes.map(t => t.eventTypeName)
        .filter((n): n is string => !!n && n.trim().length > 0)
        .join(' · ');
  }
}
