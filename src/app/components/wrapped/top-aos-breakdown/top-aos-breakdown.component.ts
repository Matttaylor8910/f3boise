import {Component, Input, OnInit} from '@angular/core';

@Component({
  selector: 'app-top-aos-breakdown',
  templateUrl: './top-aos-breakdown.component.html',
  styleUrls: ['./top-aos-breakdown.component.scss'],
})
export class TopAosBreakdownComponent implements OnInit {
  @Input() topAOs: Array<{name: string; posts: number; percentage: number}> = [];
  @Input() backgroundGradient: string = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

  ngOnInit() {
    // Component initialized
  }
}

