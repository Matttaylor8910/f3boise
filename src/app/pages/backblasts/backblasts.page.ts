import {Component, OnInit, ViewChild} from '@angular/core';
import {IonInfiniteScroll} from '@ionic/angular';
import {BackblastService} from 'src/app/services/backblast.service';
import {UtilService} from 'src/app/services/util.service';
import {Backblast} from 'types';

const SIZE = 48;
const MAX_SUGGESTIONS = 8;

type FilterField = 'pax'|'qs'|'ao'|'date';

interface FieldConfig {
  value: FilterField;
  label: string;
  operators: string[];
  placeholder: string;
}

const FIELD_CONFIGS: FieldConfig[] = [
  {
    value: 'pax',
    label: 'PAX',
    operators: ['includes', 'does not include'],
    placeholder: 'Type a PAX name',
  },
  {
    value: 'qs',
    label: 'Q',
    operators: ['includes', 'does not include'],
    placeholder: 'Type a PAX name',
  },
  {
    value: 'ao',
    label: 'AO',
    operators: ['is', 'is not'],
    placeholder: 'Type an AO',
  },
  {
    value: 'date',
    label: 'Date',
    operators: ['on or after', 'on or before'],
    placeholder: '',
  },
];

interface FilterRule {
  field: FilterField;
  operator: string;
  value: string;
  suggestions: string[];
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
  @ViewChild(IonInfiniteScroll) infiniteScroll: IonInfiniteScroll|undefined;

  allBackblasts?: Backblast[];
  filteredBackblasts?: Backblast[];
  backblasts?: Backblast[];

  loading = true;

  readonly fields = FIELD_CONFIGS;

  filterState: FilterState = {
    rules: [],
  };

  private paxNames: string[] = [];
  private aoNames: string[] = [];
  private paxLower = new Set<string>();
  private aoLower = new Set<string>();

  constructor(
      public readonly utilService: UtilService,
      private readonly backblastService: BackblastService,
  ) {}

  async ngOnInit() {
    this.allBackblasts = await this.backblastService.getAllData();

    // build the typeahead pools, keeping first-seen display casing
    const pax = new Map<string, string>();
    const aos = new Map<string, string>();
    for (const bb of this.allBackblasts) {
      for (const name of [...bb.pax, ...bb.qs]) {
        const lower = name.toLowerCase();
        if (!pax.has(lower)) pax.set(lower, name);
      }
      const aoLower = bb.ao.trim().toLowerCase();
      if (!aos.has(aoLower)) aos.set(aoLower, bb.ao.trim());
    }
    const byName = (a: string, b: string) =>
        a.toLowerCase().localeCompare(b.toLowerCase());
    this.paxNames = Array.from(pax.values()).sort(byName);
    this.aoNames = Array.from(aos.values()).sort(byName);
    this.paxLower = new Set(pax.keys());
    this.aoLower = new Set(aos.keys());

    // start with an empty PAX rule so the common case is one keystroke away
    this.addFilterRule();
    this.applyFilter();
  }

  fieldConfig(rule: FilterRule): FieldConfig {
    return this.fields.find(field => field.value === rule.field) ??
        this.fields[0];
  }

  addFilterRule() {
    this.filterState.rules.push({
      field: 'pax',
      operator: 'includes',
      value: '',
      suggestions: [],
    });
  }

  removeFilterRule(index: number) {
    this.filterState.rules.splice(index, 1);
    this.applyFilter();
  }

  onFieldChange(rule: FilterRule, field: FilterField) {
    if (field === rule.field) return;
    rule.field = field;
    rule.operator = this.fieldConfig(rule).operators[0];
    rule.value = '';
    rule.suggestions = [];
    this.applyFilter();
  }

  onOperatorChange(rule: FilterRule, operator: string) {
    if (operator === rule.operator) return;
    rule.operator = operator;
    this.applyFilter();
  }

  onValueInput(rule: FilterRule, event: Event) {
    rule.value = (event.target as HTMLInputElement)?.value ?? '';
    this.updateSuggestions(rule);
    this.applyFilter();
  }

  onDateChange(rule: FilterRule, value: string|null|undefined) {
    rule.value = value ?? '';
    this.applyFilter();
  }

  /** mousedown so selection lands before the input's blur hides the list. */
  selectSuggestion(rule: FilterRule, name: string) {
    rule.value = name;
    rule.suggestions = [];
    this.applyFilter();
  }

  hideSuggestions(rule: FilterRule) {
    setTimeout(() => rule.suggestions = [], 150);
  }

  private updateSuggestions(rule: FilterRule) {
    const query = rule.value.trim().toLowerCase();
    const pool = rule.field === 'ao' ?
        this.aoNames :
        rule.field === 'date' ? [] : this.paxNames;
    if (!query) {
      rule.suggestions = [];
      return;
    }

    // names that start with the query rank above names that just contain it
    const starts: string[] = [];
    const contains: string[] = [];
    for (const name of pool) {
      const lower = name.toLowerCase();
      if (lower === query) continue;  // already typed in full
      if (lower.startsWith(query)) {
        starts.push(name);
      } else if (lower.includes(query)) {
        contains.push(name);
      }
    }
    rule.suggestions = [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
  }

  applyFilter() {
    this.loading = true;

    delete this.backblasts;

    let filtered = this.allBackblasts ?? [];
    if (this.filterState.rules.length > 0) {
      filtered =
          filtered.filter(bb => this.filterState.rules.every(
                              rule => this.applyRule(bb, rule)));
    }

    this.filteredBackblasts = filtered;

    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = false;
    }
    this.loadMore();
  }

  private applyRule(bb: Backblast, rule: FilterRule): boolean {
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
      case 'date':
        // ISO dates compare lexicographically
        return rule.operator === 'on or after' ? bb.date >= value :
                                                 bb.date <= value;
      default:
        return true;
    }
  }

  /**
   * Exact match once a full name is picked from the typeahead, otherwise a
   * forgiving substring match so results narrow while typing.
   */
  private evaluateArrayField(
      fieldValues: string[], operator: string, value: string): boolean {
    const lower = fieldValues.map(name => name.toLowerCase());
    const matches = this.paxLower.has(value) ?
        lower.includes(value) :
        lower.some(name => name.includes(value));
    return operator === 'does not include' ? !matches : matches;
  }

  private evaluateStringField(
      fieldValue: string, operator: string, value: string): boolean {
    const lower = fieldValue.trim().toLowerCase();
    const matches =
        this.aoLower.has(value) ? lower === value : lower.includes(value);
    return operator === 'is not' ? !matches : matches;
  }

  loadMore(event?: any) {
    this.loading = true;

    const doLoad = () => {
      const backblasts = this.backblasts ?? [];
      const filtered = this.filteredBackblasts ?? [];
      const start = backblasts.length;
      const end = start + SIZE;
      backblasts.push(...filtered.slice(start, end));
      this.backblasts = backblasts;

      this.loading = false;

      if (event) {
        event.target.complete();
        if (backblasts.length >= filtered.length) {
          event.target.disabled = true;
        }
      }
    };

    // When loading more via infinite scroll, defer so the "Loading more..." spinner can render
    if (event) {
      setTimeout(doLoad, 0);
    } else {
      doLoad();
    }
  }
}
