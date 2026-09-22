import type { ParsedEntry, OnboardingPayload } from '../types';

export type AuthStackParams = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

export type OnboardingStackParams = {
  Onboarding: undefined;
  TargetReveal: { targets: { dailyCalories: number; carbsGrams: number; proteinGrams: number; fatGrams: number }; profile: OnboardingPayload };
};

export type HomeTabParams = {
  Home: undefined;
  EntryConfirm: { parsed: ParsedEntry[]; rawInput: string; photoUri?: string };
  EntryDetail: { entryId: string };
};

export type DiaryTabParams = {
  Diary: undefined;
  DayDetail: { date: string };
  EntryDetail: { entryId: string };
};

export type TrackersTabParams = {
  Trackers: undefined;
  Water: { date?: string };
  Weight: { date?: string };
  Sleep: { date?: string };
};

export type SummaryTabParams = {
  WeeklySummary: undefined;
};

export type AccountTabParams = {
  Account: undefined;
  Profile: undefined;
  Goals: undefined;
  Paywall: undefined;
  Settings: undefined;
  Features: undefined;
};

export type RootTabParams = {
  HomeTab: undefined;
  DiaryTab: undefined;
  TrackersTab: undefined;
  SummaryTab: undefined;
  AccountTab: undefined;
};
