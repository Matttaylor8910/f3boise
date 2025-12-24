import {CommonModule, CurrencyPipe} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterModule} from '@angular/router';
import {IonicModule} from '@ionic/angular';

import {ActionsPopoverPageComponent} from './actions-popover/actions-popover-page.component';
import {ActionsPopoverComponent} from './actions-popover/actions-popover.component';
import {AddParticipantModalComponent} from './add-participant-modal/add-participant-modal.component';
import {AuthButtonComponent} from './auth-button/auth-button.component';
import {BackblastCardComponent} from './backblast-card/backblast-card.component';
import {BackblastGridComponent} from './backblast-grid/backblast-grid.component';
import {BestiesGridComponent} from './besties-grid/besties-grid.component';
import {CreateChallengeModalComponent} from './create-challenge-modal/create-challenge-modal.component';
import {CustomDateRangePopoverComponent} from './custom-date-range-popover/custom-date-range-popover.component';
import {DateRangePickerComponent} from './date-range-picker/date-range-picker.component';
import {HeaderComponent} from './header/header.component';
import {LoginModalComponent} from './login-modal/login-modal.component';
import {PaxAvatarComponent} from './pax-avatar/pax-avatar.component';
import {PaxChipComponent} from './pax-chip/pax-chip.component';
import {PaxListItemComponent} from './pax-list-item/pax-list-item.component';
import {PAXNameComponent} from './pax-name/pax-name.component';
import {SidebarToggleComponent} from './sidebar-toggle/sidebar-toggle.component';
import {SidebarComponent} from './sidebar/sidebar.component';
import {TimeFilterComponent} from './time-filter/time-filter.component';
import {UserMenuPopoverComponent} from './user-menu-popover/user-menu-popover.component';
import {YearGridComponent} from './year-grid/year-grid.component';
import {StatCardComponent} from './wrapped/stat-card/stat-card.component';
import {LeadershipImpactComponent} from './wrapped/leadership-impact/leadership-impact.component';
import {MonthlyChartComponent} from './wrapped/monthly-chart/monthly-chart.component';
import {DayBreakdownComponent} from './wrapped/day-breakdown/day-breakdown.component';
import {PaxNetworkComponent} from './wrapped/pax-network/pax-network.component';
import {CombinedBreakdownComponent} from './wrapped/combined-breakdown/combined-breakdown.component';
import {WorkoutTypeBreakdownComponent} from './wrapped/workout-type-breakdown/workout-type-breakdown.component';
import {HomeBaseComponent} from './wrapped/home-base/home-base.component';
import {TopAosBreakdownComponent} from './wrapped/top-aos-breakdown/top-aos-breakdown.component';
import {NarrativeSlideComponent} from './wrapped/narrative-slide/narrative-slide.component';
import {SlideChevronComponent} from './wrapped/slide-chevron/slide-chevron.component';
import {StreaksComponent} from './wrapped/streaks/streaks.component';

@NgModule({
  declarations: [
    ActionsPopoverComponent,
    ActionsPopoverPageComponent,
    AddParticipantModalComponent,
    AuthButtonComponent,
    BackblastCardComponent,
    BackblastGridComponent,
    BestiesGridComponent,
    CreateChallengeModalComponent,
    CustomDateRangePopoverComponent,
    DateRangePickerComponent,
    HeaderComponent,
    LoginModalComponent,
    PaxAvatarComponent,
    PaxChipComponent,
    PaxListItemComponent,
    PAXNameComponent,
    SidebarComponent,
    SidebarToggleComponent,
    TimeFilterComponent,
    UserMenuPopoverComponent,
    YearGridComponent,
    StatCardComponent,
    LeadershipImpactComponent,
    MonthlyChartComponent,
    DayBreakdownComponent,
    PaxNetworkComponent,
    CombinedBreakdownComponent,
    WorkoutTypeBreakdownComponent,
    HomeBaseComponent,
    TopAosBreakdownComponent,
    NarrativeSlideComponent,
    SlideChevronComponent,
    StreaksComponent,
  ],
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    RouterModule,
  ],
  exports: [
    ActionsPopoverComponent,
    ActionsPopoverPageComponent,
    AddParticipantModalComponent,
    AuthButtonComponent,
    BackblastCardComponent,
    BackblastGridComponent,
    BestiesGridComponent,
    CreateChallengeModalComponent,
    DateRangePickerComponent,
    HeaderComponent,
    LoginModalComponent,
    PaxAvatarComponent,
    PaxChipComponent,
    PaxListItemComponent,
    PAXNameComponent,
    SidebarComponent,
    SidebarToggleComponent,
    TimeFilterComponent,
    UserMenuPopoverComponent,
    YearGridComponent,
    StatCardComponent,
    LeadershipImpactComponent,
    MonthlyChartComponent,
    DayBreakdownComponent,
    PaxNetworkComponent,
    CombinedBreakdownComponent,
    WorkoutTypeBreakdownComponent,
    HomeBaseComponent,
    TopAosBreakdownComponent,
    NarrativeSlideComponent,
    SlideChevronComponent,
    StreaksComponent,
  ],
  providers: [
    CurrencyPipe,
  ]
})
export class ComponentsModule {
}
