import * as React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { Button, Text as PaperText, TextInput, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParams } from '../../navigation/types';
import { api } from '../../api/client';
import { useSession, useToasts } from '../../stores';
import { PrimaryButton } from '../../components/inputs';
import { AppHeader } from '../../components/ui';

type LoginFieldValues = { email: string; password: string };
type SignupFieldValues = { email: string; password: string; confirm: string };

function AuthShell({ children, title, subtitle, back }: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  back?: (() => void) | null;
}) {
  const theme = useTheme();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <View style={[styles.inner, { backgroundColor: theme.colors.background }]}>
        {back ? <AppHeader onBack={back} hairline={false} /> : null}
        <View style={styles.hero}>
          <View style={[styles.logo, { backgroundColor: theme.colors.primaryContainer }]}>
            <PaperText style={{ color: theme.colors.onPrimaryContainer, fontSize: 30, fontWeight: '700' }}>C</PaperText>
          </View>
          <Text style={[styles.title, { color: theme.colors.onBackground }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>{subtitle}</Text>
        </View>
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}

export function LoginScreen({ navigation }: NativeStackScreenProps<AuthStackParams, 'Login'>) {
  const setSession = useSession((s) => s.setSession);
  const show = useToasts((s) => s.show);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFieldValues>({ defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const session = await api.login(values.email, values.password);
      setSession(session);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not sign in');
    }
  });

  return (
    <AuthShell title="Welcome back" subtitle="A calm place to note what you ate.">
      <Controller
        control={control}
        name="email"
        rules={{
          required: 'Email is required',
          pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
        }}
        render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
          <TextInput
            label="Email"
            mode="outlined"
            autoCapitalize="none"
            keyboardType="email-address"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={!!error}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        rules={{ required: 'Password is required' }}
        render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
          <TextInput
            label="Password"
            mode="outlined"
            secureTextEntry
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={!!error}
          />
        )}
      />
      <PrimaryButton loading={isSubmitting} onPress={() => void onSubmit()}>
        Sign in
      </PrimaryButton>
      <Button onPress={() => navigation.navigate('ForgotPassword')} textColor={undefined}>
        Forgot password?
      </Button>
      <View style={styles.switchRow}>
        <Text style={styles.switchText}>New here?</Text>
        <Button mode="text" compact onPress={() => navigation.navigate('Signup')}>
          Create an account
        </Button>
      </View>
    </AuthShell>
  );
}

export function SignupScreen({ navigation }: NativeStackScreenProps<AuthStackParams, 'Signup'>) {
  const canBack = navigation.canGoBack();
  const setSession = useSession((s) => s.setSession);
  const show = useToasts((s) => s.show);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignupFieldValues>({ defaultValues: { email: '', password: '', confirm: '' } });

  const onSubmit = handleSubmit(async (values) => {
    if (values.password !== values.confirm) {
      show('Passwords do not match');
      return;
    }
    try {
      const session = await api.signup(values.email, values.password);
      setSession(session);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not create the account');
    }
  });

  return (
    <AuthShell
      title="Create your account"
      subtitle="No points, no streaks. Just a clear picture of your days."
      back={canBack ? () => navigation.goBack() : null}
    >
      <Controller
        control={control}
        name="email"
        rules={{ required: 'Email is required' }}
        render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
          <TextInput
            label="Email"
            mode="outlined"
            autoCapitalize="none"
            keyboardType="email-address"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={!!error}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        rules={{ required: 'Password is required', minLength: { value: 6, message: 'Use at least 6 characters' } }}
        render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
          <TextInput
            label="Password"
            mode="outlined"
            secureTextEntry
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={!!error}
          />
        )}
      />
      <Controller
        control={control}
        name="confirm"
        rules={{ required: 'Confirm your password' }}
        render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
          <TextInput
            label="Confirm password"
            mode="outlined"
            secureTextEntry
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={!!error}
          />
        )}
      />
      <PrimaryButton loading={isSubmitting} onPress={() => void onSubmit()}>
        Create account
      </PrimaryButton>
      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Already have an account?</Text>
        <Button mode="text" compact onPress={() => navigation.navigate('Login')}>
          Sign in
        </Button>
      </View>
    </AuthShell>
  );
}

export function ForgotPasswordScreen({ navigation }: NativeStackScreenProps<AuthStackParams, 'ForgotPassword'>) {
  const canBack = navigation.canGoBack();
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{ email: string }>({ defaultValues: { email: '' } });
  const [sent, setSent] = React.useState(false);

  const onSubmit = handleSubmit(async (values) => {
    await api.forgotPassword(values.email);
    setSent(true);
  });

  return (
    <AuthShell title="Reset password" subtitle="We'll email you a reset link." back={canBack ? () => navigation.goBack() : null}>
      <Controller
        control={control}
        name="email"
        rules={{ required: 'Email is required' }}
        render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
          <TextInput
            label="Email"
            mode="outlined"
            autoCapitalize="none"
            keyboardType="email-address"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={!!error}
          />
        )}
      />
      {sent ? (
        <PaperText style={styles.sentNote}>Check your inbox for the reset link.</PaperText>
      ) : (
        <PrimaryButton loading={isSubmitting} onPress={() => void onSubmit()}>
          Send reset link
        </PrimaryButton>
      )}
      <Button onPress={() => navigation.goBack()}>Back to sign in</Button>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', padding: 24, gap: 10 },
  hero: { alignItems: 'center', marginBottom: 24, gap: 6 },
  logo: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 14, textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  switchText: { fontSize: 14 },
  sentNote: { textAlign: 'center', marginTop: 8 },
});
