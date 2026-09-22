import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AccountTabParams } from '../../navigation/types';
import { usePrefs } from '../../stores';
import { checkPro, getPlans, isRevenueCatConfigured, purchase, restore, PlanOption } from '../../services/purchases';
import { PrimaryButton } from '../../components/inputs';
import { Screen, SectionTitle } from '../../components/ui';
import { useToasts } from '../../stores';

type Props = NativeStackScreenProps<AccountTabParams, 'Paywall'>;

const PRO_FEATURES = [
  'Photo logging with itemized estimates',
  'Weekly summaries and trends',
  'Unlimited history',
  'Priority support from a small team',
];

export default function PaywallScreen({ navigation }: Props) {
  const theme = useTheme();
  const show = useToasts((s) => s.show);
  const simulatedPro = usePrefs((s) => s.simulatedPro);
  const setSimulatedPro = usePrefs((s) => s.setSimulatedPro);
  const [plans, setPlans] = React.useState<PlanOption[]>([]);
  const [simulated, setSimulated] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [pro, setPro] = React.useState(simulatedPro);

  React.useEffect(() => {
    void (async () => {
      const { plans: p, simulated: sim } = await getPlans();
      setPlans(p);
      setSimulated(sim);
      const active = await checkPro();
      if (active) setPro(true);
    })();
  }, []);

  const onPurchase = async (planId: string) => {
    if (planId === 'free') {
      setSimulatedPro(false);
      setPro(false);
      show('Switched to the free plan');
      return;
    }
    setBusy(planId);
    try {
      if (simulated) {
        // No store keys configured — simulate a calm successful upgrade.
        setSimulatedPro(true);
        setPro(true);
        show('Pro is on. Thanks for supporting Caloria.');
        return;
      }
      const ok = await purchase(planId as never);
      if (ok) {
        setPro(true);
        show('Pro is on. Thanks for supporting Caloria.');
      } else {
        show('Purchase did not complete');
      }
    } catch {
      show('The store was unavailable — try again later');
    } finally {
      setBusy(null);
    }
  };

  const onRestore = async () => {
    setBusy('restore');
    try {
      if (simulated) {
        show('Nothing to restore in simulated mode');
        return;
      }
      const ok = await restore();
      if (ok) {
        setPro(true);
        show('Purchases restored');
      } else {
        show('No active purchase found');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen scroll title="Caloria Pro">
      <Text style={[styles.sub, { color: theme.colors.onSurfaceVariant }]}>
        {pro ? 'You have everything unlocked.' : 'Optional. The free plan is a complete diary.'}
      </Text>

      <View style={styles.features}>
        {PRO_FEATURES.map((f) => (
          <Text key={f} style={[styles.feature, { color: theme.colors.onSurface }]}>• {f}</Text>
        ))}
      </View>

      {isRevenueCatConfigured() ? null : (
        <Text style={[styles.simNote, { color: theme.colors.onSurfaceVariant }]}>
          Simulated store (no RevenueCat keys configured).
        </Text>
      )}

      <View style={styles.plans}>
        {plans.map((plan) => {
          const current = (plan.id === 'free' && !pro) || (plan.id !== 'free' && pro);
          return (
            <Card
              key={plan.id}
              mode="contained"
              style={[styles.planCard, current && { borderColor: theme.colors.primary }]}
              onPress={() => void onPurchase(plan.id)}
            >
              <Card.Content>
                <View style={styles.planRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planTitle, { color: theme.colors.onSurface }]}>{plan.title}</Text>
                    <Text style={[styles.planDesc, { color: theme.colors.onSurfaceVariant }]}>{plan.description}</Text>
                  </View>
                  <View style={styles.priceWrap}>
                    <Text style={[styles.price, { color: theme.colors.onSurface }]}>{plan.priceLabel}</Text>
                    <Text style={[styles.period, { color: theme.colors.onSurfaceVariant }]}>{plan.periodLabel}</Text>
                  </View>
                </View>
                {current ? (
                  <Text style={[styles.currentTag, { color: theme.colors.primary }]}>Current plan</Text>
                ) : null}
              </Card.Content>
            </Card>
          );
        })}
      </View>

      <PrimaryButton
        onPress={() => void onPurchase(pro ? 'free' : 'pro_monthly')}
        loading={busy === 'pro_monthly' || busy === 'restore'}
        style={{ marginTop: 8 }}
      >
        {pro ? 'Switch to free' : 'Start Pro Monthly'}
      </PrimaryButton>
      <Button onPress={() => void onRestore()} textColor={theme.colors.onSurfaceVariant}>
        Restore purchases
      </Button>

      <Text style={[styles.legal, { color: theme.colors.onSurfaceVariant }]}>
        Subscriptions renew automatically and can be canceled anytime in your store settings.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { fontSize: 13.5, marginTop: 2 },
  features: { gap: 6, marginVertical: 14 },
  feature: { fontSize: 14 },
  simNote: { fontSize: 12, marginBottom: 8 },
  plans: { gap: 10 },
  planCard: { borderRadius: 16 },
  planRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  planTitle: { fontSize: 16, fontWeight: '600' },
  planDesc: { fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  priceWrap: { alignItems: 'flex-end' },
  price: { fontSize: 16, fontWeight: '700' },
  period: { fontSize: 11.5 },
  currentTag: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  legal: { fontSize: 11.5, marginTop: 10, textAlign: 'center', lineHeight: 16 },
});
