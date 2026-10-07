import {Component, Input} from '@angular/core';
import {openSlack} from 'src/app/util/slack';

/**
 * A button into the F3 Boise Slack: the AO's channel when one is given, so a
 * PAX can claim a Q or read the preblast, else the workspace.
 */
@Component({
  selector: 'app-slack-link',
  templateUrl: './slack-link.component.html',
  styleUrls: ['./slack-link.component.scss'],
})
export class SlackLinkComponent {
  /** Backblast AO name (any casing) whose channel to open. */
  @Input() ao?: string;
  @Input() label = 'Open Slack';
  @Input() fill: 'outline'|'solid'|'clear' = 'outline';

  open(event: Event) {
    event.stopPropagation();
    openSlack(this.ao);
  }
}
