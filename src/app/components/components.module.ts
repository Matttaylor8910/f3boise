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
import {BeatdownBreakdownBannerComponent} from './beatdown-breakdown-banner/beatdown-breakdown-banner.component';
import {BestiesGridComponent} from './besties-grid/besties-grid.component';
import {CreateChallengeModalComponent} from './create-challenge-modal/create-challenge-modal.component';
import {CustomDateRangePopoverComponent} from './custom-date-range-popover/custom-date-range-popover.component';
import {DateRangePickerComponent} from './date-range-picker/date-range-picker.component';
import {GoogleFormModalComponent} from './google-form-modal/google-form-modal.component';
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
import {BestieGuessComponent} from './wrapped/bestie-guess/bestie-guess.component';
import {CombinedBreakdownComponent} from './wrapped/combined-breakdown/combined-breakdown.component';
import {DayBreakdownComponent} from './wrapped/day-breakdown/day-breakdown.component';
import {HomeBaseComponent} from './wrapped/home-base/home-base.component';
import {LeadershipImpactComponent} from './wrapped/leadership-impact/leadership-impact.component';
import {MonthlyChartComponent} from './wrapped/monthly-chart/monthly-chart.component';
import {NarrativeSlideComponent} from './wrapped/narrative-slide/narrative-slide.component';
import {PaxNetworkComponent} from './wrapped/pax-network/pax-network.component';
import {RegionalGrowthStatsComponent} from './wrapped/regional-growth-stats/regional-growth-stats.component';
import {SlideChevronComponent} from './wrapped/slide-chevron/slide-chevron.component';
import {StatCardComponent} from './wrapped/stat-card/stat-card.component';
import {StreaksComponent} from './wrapped/streaks/streaks.component';
import {TopAosBreakdownComponent} from './wrapped/top-aos-breakdown/top-aos-breakdown.component';
import {VideoSlideComponent} from './wrapped/video-slide/video-slide.component';
import {WorkoutTypeBreakdownComponent} from './wrapped/workout-type-breakdown/workout-type-breakdown.component';
import {YouVsYouComponent} from './wrapped/you-vs-you/you-vs-you.component';
import {YearGridComponent} from './year-grid/year-grid.component';

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
    VideoSlideComponent,
    BestieGuessComponent,
    RegionalGrowthStatsComponent,
    YouVsYouComponent,
    BeatdownBreakdownBannerComponent,
    GoogleFormModalComponent,
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
    VideoSlideComponent,
    BestieGuessComponent,
    RegionalGrowthStatsComponent,
    YouVsYouComponent,
    BeatdownBreakdownBannerComponent,
    GoogleFormModalComponent,
  ],
  providers: [
    CurrencyPipe,
  ]
})
export class ComponentsModule {
}
