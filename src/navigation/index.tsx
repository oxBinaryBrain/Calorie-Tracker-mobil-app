import * as React from 'react';
import { DarkTheme as NavDark, DefaultTheme as NavLight, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet } from 'react-native';import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from 'react-native-paper';

import { useSession } from '../stores';
import { lightTheme, darkTheme, fontFamilies } from '../theme';
import type {
  AccountTabParams,
  AuthStackParams,
  DiaryTabParams,
  HomeTabParams,
  OnboardingStackParams,
  RootTabParams,
  SummaryTabParams,
  TrackersTabParams,
} from './types';

import { LoginScreen, SignupScreen, ForgotPasswordScreen } from '../screens/auth/AuthScreens';
import { OnboardingScreen, TargetRevealScreen } from '../screens/onboarding/OnboardingScreens';
import IntroScreen from '../screens/intro/IntroScreen';
import HomeScreen from '../screens/home/HomeScreen';
import EntryConfirmScreen from '../screens/logging/EntryConfirmScreen';
import EntryDetailScreen from '../screens/entries/EntryDetailScreen';
import DiaryScreen from '../screens/diary/DiaryScreen';
import DayDetailScreen from '../screens/diary/DayDetailScreen';
import TrackersScreen from '../screens/trackers/TrackersScreen';
import { WaterScreen, WeightScreen, SleepScreen } from '../screens/trackers/TrackerScreens';
import WeeklySummaryScreen from '../screens/summary/WeeklySummaryScreen';
import AccountScreen from '../screens/account/AccountScreen';
import ProfileScreen from '../screens/account/ProfileScreen';
import GoalsScreen from '../screens/account/GoalsScreen';
import PaywallScreen from '../screens/account/PaywallScreen';
import SettingsScreen from '../screens/account/SettingsScreen';
import FeaturesScreen from '../screens/account/FeaturesScreen';
import { withEntrance } from '../components/ui';

// Pushed screens. On iOS/Android the native stack slides them in; on web
// withEntrance adds the equivalent self-animation (native stacks do not
// animate there). Tab roots are not wrapped — they never slide.
const PushedEntryConfirm = withEntrance(EntryConfirmScreen);
const PushedEntryDetail = withEntrance(EntryDetailScreen);
const PushedDayDetail = withEntrance(DayDetailScreen);
const PushedWater = withEntrance(WaterScreen);
const PushedWeight = withEntrance(WeightScreen);
const PushedSleep = withEntrance(SleepScreen);
const PushedProfile = withEntrance(ProfileScreen);
const PushedGoals = withEntrance(GoalsScreen);
const PushedPaywall = withEntrance(PaywallScreen);
const PushedSettings = withEntrance(SettingsScreen);
const PushedFeatures = withEntrance(FeaturesScreen);

const AuthStack = createNativeStackNavigator<AuthStackParams>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParams>();
const Tabs = createBottomTabNavigator<RootTabParams>();
const HomeStack = createNativeStackNavigator<HomeTabParams>();
const DiaryStack = createNativeStackNavigator<DiaryTabParams>();
const TrackersStack = createNativeStackNavigator<TrackersTabParams>();
const SummaryStack = createNativeStackNavigator<SummaryTabParams>();
const AccountStack = createNativeStackNavigator<AccountTabParams>();

const TAB_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  HomeTab: 'home-variant-outline',
  DiaryTab: 'calendar-blank-outline',
  TrackersTab: 'water-outline',
  SummaryTab: 'chart-box-outline',
  AccountTab: 'account-circle-outline',
};

const TAB_ICONS_FOCUSED: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  HomeTab: 'home-variant',
  DiaryTab: 'calendar',
  TrackersTab: 'cup',
  SummaryTab: 'chart-box',
  AccountTab: 'account',
};

function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="Onboarding" component={OnboardingScreen} />
      <OnboardingStack.Screen name="TargetReveal" component={TargetRevealScreen} />
    </OnboardingStack.Navigator>
  );
}

// Native-stack headers are disabled everywhere: they do not render on web at
// all (the cause of the missing back buttons), and on native the shared
// AppHeader gives one consistent iOS-style chrome instead of two systems.
// Native stacks slide pushed screens in from the right, iOS-style; on web the
// withEntrance wrapper provides the equivalent (see components/ui).
const stackScreenOptions = { headerShown: false, animation: 'slide_from_right' } as const;

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={stackScreenOptions}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="EntryConfirm" component={PushedEntryConfirm} />
      <HomeStack.Screen name="EntryDetail" component={PushedEntryDetail} />
    </HomeStack.Navigator>
  );
}

function DiaryStackNavigator() {
  return (
    <DiaryStack.Navigator screenOptions={stackScreenOptions}>
      <DiaryStack.Screen name="Diary" component={DiaryScreen} />
      <DiaryStack.Screen name="DayDetail" component={PushedDayDetail} />
      <DiaryStack.Screen name="EntryDetail" component={PushedEntryDetail} />
    </DiaryStack.Navigator>
  );
}

function TrackersStackNavigator() {
  return (
    <TrackersStack.Navigator screenOptions={stackScreenOptions}>
      <TrackersStack.Screen name="Trackers" component={TrackersScreen} />
      <TrackersStack.Screen name="Water" component={PushedWater} />
      <TrackersStack.Screen name="Weight" component={PushedWeight} />
      <TrackersStack.Screen name="Sleep" component={PushedSleep} />
    </TrackersStack.Navigator>
  );
}

function SummaryStackNavigator() {
  return (
    <SummaryStack.Navigator screenOptions={stackScreenOptions}>
      <SummaryStack.Screen name="WeeklySummary" component={WeeklySummaryScreen} />
    </SummaryStack.Navigator>
  );
}

function AccountStackNavigator() {
  return (
    <AccountStack.Navigator screenOptions={stackScreenOptions}>
      <AccountStack.Screen name="Account" component={AccountScreen} />
      <AccountStack.Screen name="Profile" component={PushedProfile} />
      <AccountStack.Screen name="Goals" component={PushedGoals} />
      <AccountStack.Screen name="Paywall" component={PushedPaywall} />
      <AccountStack.Screen name="Settings" component={PushedSettings} />
      <AccountStack.Screen name="Features" component={PushedFeatures} />
    </AccountStack.Navigator>
  );
}

function TabIcon({ route, color, size, focused }: { route: any; color: string; size: number; focused: boolean }) {
  const name = focused ? TAB_ICONS_FOCUSED[route.name] ?? TAB_ICONS[route.name] : TAB_ICONS[route.name];
  return <MaterialCommunityIcons name={name} size={23} color={color} />;
}

function MainTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        // The tab bar needs an explicit height budget: icon (24) + gap (2) +
        // label (~14) + paddings. Without it, the bar's fixed default height
        // gives the label zero room and it collapses to invisible — the DOM
        // still contains it, so it looks correct in a snapshot but not on
        // screen.
        tabBarStyle: {
          height: 86 + Math.max(insets.bottom, 7),
          borderTopColor: theme.colors.outlineVariant,
          paddingTop: 7,
          paddingBottom: Math.max(insets.bottom, 7),
          ...(Platform.OS === 'web'
            ? {
                backgroundColor: theme.dark ? 'rgba(33, 35, 33, 0.92)' : 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(20px) saturate(180%)',
              }
            : { backgroundColor: theme.colors.surface }),
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: '600',
          letterSpacing: 0.3,
          fontFamily: fontFamilies.medium,
        },
        tabBarIcon: (props) => <TabIcon {...props} route={route} />,
      })}
    >
      <Tabs.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: 'Home' }} />
      <Tabs.Screen name="DiaryTab" component={DiaryStackNavigator} options={{ title: 'Diary' }} />
      <Tabs.Screen name="TrackersTab" component={TrackersStackNavigator} options={{ title: 'Trackers' }} />
      <Tabs.Screen name="SummaryTab" component={SummaryStackNavigator} options={{ title: 'Summary' }} />
      <Tabs.Screen name="AccountTab" component={AccountStackNavigator} options={{ title: 'Account' }} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const paper = useTheme();
  const token = useSession((s) => s.token);
  const onboarded = useSession((s) => s.onboarded);
  const ready = useSession((s) => s.ready);
  const [introDone, setIntroDone] = React.useState(false);

  const navTheme = React.useMemo(() => {
    const base = paper.dark ? NavDark : NavLight;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: paper.colors.primary,
        background: paper.colors.background,
        card: paper.colors.surface,
        text: paper.colors.onSurface,
        border: paper.colors.outlineVariant,
        notification: paper.colors.primary,
      },
    };
  }, [paper]);

  return (
    <NavigationContainer theme={navTheme as typeof NavLight}>
      {!introDone ? (
        <IntroScreen onDone={() => setIntroDone(true)} />
      ) : !ready ? (
        null
      ) : token == null ? (
        <AuthStack.Navigator key="auth" screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Signup" component={SignupScreen} />
          <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </AuthStack.Navigator>
      ) : !onboarded ? (
        <OnboardingNavigator key="onboarding" />
      ) : (
        <MainTabs key="main" />
      )}
    </NavigationContainer>
  );
}
