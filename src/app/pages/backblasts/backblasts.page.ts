import {Component, OnInit} from '@angular/core';
import {BackblastService} from 'src/app/services/backblast.service';
import {Backblast} from 'types';

const SIZE = 48;

interface FilterRule {
  field: 'qs'|'pax'|'ao';
  operator: 'includes'|'does not include'|'is'|'is not';
  value: string;
}

interface FilterState {
  rules: FilterRule[];
}


@Component({
  selector: 'app-backblasts',
  templateUrl: './backblasts.page.html',
  styleUrls: ['./backblasts.page.scss'],
})
export class BackblastsPage implements OnInit {
  allBackblasts?: Backblast[];
  filteredBackblasts?: Backblast[];
  backblasts?: Backblast[];

  loading = true;

  // Remove the old filterText
  // filterText = '';

  // Add filter state
  filterState: FilterState = {
    rules: [],
  };

  constructor(private readonly backblastService: BackblastService) {}

  get showLoadMore(): boolean {
    const moreBackblasts =
        (this.filteredBackblasts?.length ?? 0) > (this.backblasts?.length ?? 0);
    return !this.loading && moreBackblasts;
  }

  async ngOnInit() {
    this.allBackblasts = await this.backblastService.getAllData();

    this.applyFilter();
  }

  addFilterRule() {
    this.filterState.rules.push({
      field: 'pax',
      operator: 'includes',
      value: '',
    });
  }

  removeFilterRule(index: number) {
    this.filterState.rules.splice(index, 1);
    this.applyFilter();
  }

  applyFilter() {
    this.loading = true;

    delete this.backblasts;

    // Start with all backblasts
    let filtered = this.allBackblasts ?? [];

    // Apply each filter rule
    if (this.filterState.rules.length > 0) {
      filtered = filtered.filter(bb => {
        for (let i = 0; i < this.filterState.rules.length; i++) {
          const rule = this.filterState.rules[i];
          if (!this.applyRule(bb, rule)) return false;
        }

        return true;
      });
    }

    this.filteredBackblasts = filtered;

    this.loadMore();
  }

  applyRule(bb: Backblast, rule: FilterRule): boolean {
    const value = rule.value.toLowerCase().trim();
    if (!value) {
      return true;
    }

    switch (rule.field) {
      case 'qs':
        return this.evaluateArrayField(bb.qs, rule.operator, value);
      case 'pax':
        return this.evaluateArrayField(bb.pax, rule.operator, value);
      case 'ao':
        return this.evaluateStringField(bb.ao, rule.operator, value);
      default:
        return true;
    }
  }

  evaluateArrayField(fieldValues: string[], operator: string, value: string):
      boolean {
    const fieldValuesLower = fieldValues.map((v) => v.toLowerCase());
    const includesValue = fieldValuesLower.includes(value);

    if (operator === 'includes') {
      return includesValue;
    } else if (operator === 'does not include') {
      return !includesValue;
    } else {
      return true;
    }
  }

  evaluateStringField(fieldValue: string, operator: string, value: string):
      boolean {
    const fieldValueLower = fieldValue.toLowerCase();

    if (operator === 'is') {
      return fieldValueLower === value;
    } else if (operator === 'is not') {
      return fieldValueLower !== value;
    } else {
      return true;
    }
  }

  loadMore() {
    this.loading = true;

    setTimeout(() => {
      const backblasts = this.backblasts ?? [];

      const filtered = this.filteredBackblasts ?? [];
      const start = backblasts.length;
      const end = start + SIZE;
      backblasts.push(...filtered.slice(start, end));
      this.backblasts = backblasts;

      this.loading = false;
    });
  }
}
