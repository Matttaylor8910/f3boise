import {Component, Input, OnInit, AfterViewInit, ViewChild, ElementRef} from '@angular/core';
import {MonthlyData} from '../../../interfaces/wrapped-data.interface';

@Component({
  selector: 'app-monthly-chart',
  templateUrl: './monthly-chart.component.html',
  styleUrls: ['./monthly-chart.component.scss'],
})
export class MonthlyChartComponent implements OnInit, AfterViewInit {
  @Input() data: MonthlyData[] = [];
  @Input() backgroundGradient: string = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;

  maxMonth = '';

  ngOnInit() {
    if (this.data.length > 0) {
      const maxData = this.data.reduce((max, current) => 
        current.posts > max.posts ? current : max
      );
      this.maxMonth = maxData.month;
    }
  }

  getDescription(): string {
    if (!this.data.length || !this.maxMonth) return '';
    const maxData = this.data.find(d => d.month === this.maxMonth);
    if (!maxData) return '';
    
    return `${this.maxMonth} was your strongest month with ${maxData.posts} posts. But it's not about the spike - it's about showing up month after month. That's how HIMs are made.`;
  }

  ngAfterViewInit() {
    this.createChart();
  }

  createChart() {
    if (!this.data || this.data.length === 0) return;

    const container = this.chartContainer.nativeElement;
    const containerWidth = container.offsetWidth || 500;
    const containerHeight = container.offsetHeight || 400;
    
    const width = Math.min(containerWidth, 500);
    const height = Math.max(400, Math.min(containerHeight, 450));
    const padding = { top: 30, right: 30, bottom: 60, left: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxPosts = Math.max(...this.data.map(d => d.posts));
    const barWidth = chartWidth / this.data.length - 8;

    let svgContent = '';

    this.data.forEach((d, i) => {
      const barHeight = (d.posts / maxPosts) * chartHeight;
      const x = padding.left + (i * (chartWidth / this.data.length)) + 4;
      const y = height - padding.bottom - barHeight;

      svgContent += `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" 
              fill="rgba(255,255,255,0.8)" rx="6" ry="6">
          <animate attributeName="height" from="0" to="${barHeight}" 
                   dur="0.8s" begin="${i * 0.1}s" fill="freeze"/>
          <animate attributeName="y" from="${height - padding.bottom}" to="${y}" 
                   dur="0.8s" begin="${i * 0.1}s" fill="freeze"/>
        </rect>
        <text x="${x + barWidth/2}" y="${height - padding.bottom + 20}" 
              text-anchor="middle" fill="white" font-size="12" font-weight="600">
          ${d.month}
        </text>
        <text x="${x + barWidth/2}" y="${y - 8}" 
              text-anchor="middle" fill="white" font-size="14" font-weight="700">
          ${d.posts}
        </text>
      `;
    });

    const svg = container.querySelector('svg');
    if (svg) {
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.innerHTML = svgContent;
    }
  }
}