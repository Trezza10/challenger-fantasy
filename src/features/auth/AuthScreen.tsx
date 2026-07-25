import Ionicons from '@expo/vector-icons/Ionicons';
import { useSignIn, useSignUp } from '@clerk/expo';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../../theme/colors';

type AuthMode = 'signIn' | 'signUp';
type VerificationMode = 'signIn' | 'signUp' | null;

/** Branded email/password authentication flow that works in Expo Go and native builds. */
export function AuthScreen() {
  const { errors: signInErrors, fetchStatus: signInStatus, signIn } = useSignIn();
  const { errors: signUpErrors, fetchStatus: signUpStatus, signUp } = useSignUp();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [verificationMode, setVerificationMode] = useState<VerificationMode>(null);
  const [username, setUsername] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');

  const isFetching = signInStatus === 'fetching' || signUpStatus === 'fetching';
  const emailError = mode === 'signIn'
    ? signInErrors.fields.identifier?.message
    : signUpErrors.fields.emailAddress?.message;
  const passwordError = mode === 'signIn'
    ? signInErrors.fields.password?.message
    : signUpErrors.fields.password?.message;
  const usernameError = signUpErrors.fields.username?.message;
  const codeError = (verificationMode === 'signIn' ? signInErrors : signUpErrors).fields.code?.message;

  /** Activates the completed session; the root auth gate handles the screen transition. */
  async function finalize(kind: 'signIn' | 'signUp') {
    const attempt = kind === 'signIn' ? signIn : signUp;
    await attempt.finalize();
  }

  /** Sends an email challenge when Clerk requires a trusted-device or MFA check. */
  async function prepareSignInVerification() {
    const supportsEmailCode = signIn.supportedSecondFactors?.some((factor) => factor.strategy === 'email_code');
    if (!supportsEmailCode) {
      setNotice('This account requires an additional sign-in method that is not available in this app yet.');
      return;
    }

    const { error } = await signIn.mfa.sendEmailCode();
    if (error) {
      setNotice(formatClerkError(error));
      return;
    }

    setCode('');
    setVerificationMode('signIn');
    setNotice(`We sent a verification code to ${emailAddress.trim()}.`);
  }

  async function submitCredentials() {
    const normalizedEmail = emailAddress.trim().toLowerCase();
    setNotice('');

    if (!normalizedEmail || !password || (mode === 'signUp' && !username.trim())) {
      setNotice(mode === 'signUp'
        ? 'Enter a username, email address, and password.'
        : 'Enter your email address and password.');
      return;
    }

    if (mode === 'signIn') {
      const { error } = await signIn.password({ emailAddress: normalizedEmail, password });
      if (error) {
        setNotice(formatClerkError(error));
        return;
      }

      if (signIn.status === 'complete') {
        await finalize('signIn');
      } else if (signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust') {
        await prepareSignInVerification();
      } else {
        setNotice('Your sign-in needs another step that is not available yet.');
      }
      return;
    }

    const { error } = await signUp.password({
      emailAddress: normalizedEmail,
      password,
      username: username.trim(),
    });
    if (error) {
      setNotice(formatClerkError(error));
      return;
    }

    if (signUp.status === 'complete') {
      await finalize('signUp');
      return;
    }

    const { error: verificationError } = await signUp.verifications.sendEmailCode();
    if (verificationError) {
      setNotice(formatClerkError(verificationError));
      return;
    }

    setCode('');
    setVerificationMode('signUp');
    setNotice(`We sent a verification code to ${normalizedEmail}.`);
  }

  async function verifyCode() {
    setNotice('');
    if (!code.trim()) {
      setNotice('Enter the verification code from your email.');
      return;
    }

    if (verificationMode === 'signIn') {
      const { error } = await signIn.mfa.verifyEmailCode({ code: code.trim() });
      if (error) {
        setNotice(formatClerkError(error));
        return;
      }
      if (signIn.status === 'complete') await finalize('signIn');
      return;
    }

    const { error } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
    if (error) {
      setNotice(formatClerkError(error));
      return;
    }
    if (signUp.status === 'complete') await finalize('signUp');
  }

  async function resendCode() {
    setNotice('');
    const result = verificationMode === 'signIn'
      ? await signIn.mfa.sendEmailCode()
      : await signUp.verifications.sendEmailCode();
    setNotice(result.error ? formatClerkError(result.error) : 'A new verification code is on its way.');
  }

  function switchMode(nextMode: AuthMode) {
    signIn.reset();
    signUp.reset();
    setMode(nextMode);
    setVerificationMode(null);
    setCode('');
    setPassword('');
    setUsername('');
    setNotice('');
  }

  function restartFlow() {
    signIn.reset();
    signUp.reset();
    setVerificationMode(null);
    setCode('');
    setNotice('');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Image resizeMode="contain" source={require('../../../assets/challengers-wordmark-4.png')} style={styles.wordmark} />
            <Text style={styles.kicker}>YOUR LEAGUE. YOUR LINEUP. YOUR EDGE.</Text>
          </View>

          <View style={styles.card}>
            {verificationMode ? (
              <>
                <View style={styles.iconBadge}>
                  <Ionicons color={colors.accent} name="mail-outline" size={25} />
                </View>
                <Text style={styles.title}>Check your email</Text>
                <Text style={styles.subtitle}>Enter the six-digit code we sent to finish securing your account.</Text>
                <AuthField
                  autoComplete="one-time-code"
                  keyboardType="number-pad"
                  label="VERIFICATION CODE"
                  onChangeText={setCode}
                  placeholder="000000"
                  value={code}
                />
                {!!codeError && <Text style={styles.error}>{codeError}</Text>}
                {!!notice && <Text style={styles.notice}>{notice}</Text>}
                <AuthButton disabled={isFetching || !code.trim()} label={isFetching ? 'VERIFYING…' : 'VERIFY & CONTINUE'} onPress={verifyCode} />
                <Pressable disabled={isFetching} onPress={resendCode} style={styles.textButton}>
                  <Text style={styles.textButtonLabel}>SEND A NEW CODE</Text>
                </Pressable>
                <Pressable disabled={isFetching} onPress={restartFlow} style={styles.textButton}>
                  <Text style={styles.mutedButtonLabel}>USE A DIFFERENT EMAIL</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.segmentedControl}>
                  <AuthTab active={mode === 'signIn'} label="SIGN IN" onPress={() => switchMode('signIn')} />
                  <AuthTab active={mode === 'signUp'} label="CREATE ACCOUNT" onPress={() => switchMode('signUp')} />
                </View>
                <Text style={styles.title}>{mode === 'signIn' ? 'Welcome back' : 'Join the competition'}</Text>
                <Text style={styles.subtitle}>
                  {mode === 'signIn'
                    ? 'Sign in to manage your team and make your next move.'
                    : 'Create your manager account and get ready for draft day.'}
                </Text>
                {mode === 'signUp' && (
                  <>
                    <AuthField
                      autoCapitalize="none"
                      autoComplete="username-new"
                      label="MANAGER USERNAME"
                      onChangeText={setUsername}
                      placeholder="Choose your manager name"
                      value={username}
                    />
                    {!!usernameError && <Text style={styles.error}>{usernameError}</Text>}
                  </>
                )}
                <AuthField
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  label="EMAIL ADDRESS"
                  onChangeText={setEmailAddress}
                  placeholder="manager@example.com"
                  value={emailAddress}
                />
                {!!emailError && <Text style={styles.error}>{emailError}</Text>}
                <View>
                  <AuthField
                    autoCapitalize="none"
                    autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                    label="PASSWORD"
                    onChangeText={setPassword}
                    onSubmitEditing={submitCredentials}
                    placeholder={mode === 'signIn' ? 'Enter your password' : 'Create a secure password'}
                    secureTextEntry={!showPassword}
                    value={password}
                  />
                  <Pressable accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} hitSlop={12} onPress={() => setShowPassword((current) => !current)} style={styles.passwordToggle}>
                    <Ionicons color={colors.muted} name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} />
                  </Pressable>
                </View>
                {!!passwordError && <Text style={styles.error}>{passwordError}</Text>}
                {!!notice && <Text style={styles.notice}>{notice}</Text>}
                <AuthButton
                  disabled={isFetching || !emailAddress.trim() || !password || (mode === 'signUp' && !username.trim())}
                  label={isFetching ? 'PLEASE WAIT…' : mode === 'signIn' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                  onPress={submitCredentials}
                />
                {mode === 'signUp' && <Text style={styles.terms}>By creating an account, you agree to play fair and follow your league rules.</Text>}
              </>
            )}

            {/* Clerk bot protection renders its challenge into this required native mount point. */}
            <View nativeID="clerk-captcha" />
          </View>
          <View style={styles.securityNote}>
            <Ionicons color={colors.muted} name="shield-checkmark-outline" size={15} />
            <Text style={styles.securityText}>Authentication secured by Clerk</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AuthField(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        style={styles.input}
      />
    </View>
  );
}

function AuthButton({ disabled, label, onPress }: { disabled: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      <Text style={styles.primaryButtonLabel}>{label}</Text>
      {!disabled && <Ionicons color={colors.background} name="arrow-forward" size={18} />}
    </Pressable>
  );
}

function AuthTab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.tab, active && styles.activeTab]}>
      <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>{label}</Text>
    </Pressable>
  );
}

/** Converts Clerk or network failures into a concise message without exposing raw response data. */
function formatClerkError(error: unknown) {
  if (typeof error === 'object' && error) {
    const clerkError = error as {
      errors?: { code?: string; longMessage?: string; message?: string }[];
      message?: string;
    };
    const detail = clerkError.errors?.[0];
    if (detail?.longMessage || detail?.message) return detail.longMessage ?? detail.message ?? 'Authentication failed.';
    if (clerkError.message) return clerkError.message;
  }
  return 'Authentication failed. Check your connection and try again.';
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 36 },
  brand: { alignItems: 'center', marginBottom: 28 },
  wordmark: { height: 82, width: '100%' },
  kicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginTop: 7 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 22, borderWidth: 1, padding: 20 },
  segmentedControl: { backgroundColor: colors.background, borderRadius: 10, flexDirection: 'row', marginBottom: 24, padding: 4 },
  tab: { alignItems: 'center', borderRadius: 8, flex: 1, paddingVertical: 10 },
  activeTab: { backgroundColor: '#1B2724' },
  tabLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: .9 },
  activeTabLabel: { color: colors.accent },
  iconBadge: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#18231F', borderColor: '#314139', borderRadius: 28, borderWidth: 1, height: 56, justifyContent: 'center', marginBottom: 17, width: 56 },
  title: { color: colors.text, fontSize: 25, fontWeight: '900', letterSpacing: -.4 },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 22, marginTop: 7 },
  field: { marginTop: 13 },
  label: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: .9, marginBottom: 7 },
  input: { backgroundColor: '#101817', borderColor: colors.border, borderRadius: 10, borderWidth: 1, color: colors.text, fontSize: 15, height: 49, paddingHorizontal: 13, paddingRight: 44 },
  passwordToggle: { bottom: 14, position: 'absolute', right: 14 },
  error: { color: '#FF8C8C', fontSize: 11, fontWeight: '600', lineHeight: 16, marginTop: 6 },
  notice: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', lineHeight: 16, marginTop: 12 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 10, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 22, minHeight: 49, paddingHorizontal: 18 },
  primaryButtonLabel: { color: colors.background, fontSize: 11, fontWeight: '900', letterSpacing: .9 },
  disabled: { opacity: .45 },
  pressed: { opacity: .8, transform: [{ scale: .99 }] },
  textButton: { alignItems: 'center', paddingTop: 18 },
  textButtonLabel: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: .7 },
  mutedButtonLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: .6 },
  terms: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 14, textAlign: 'center' },
  securityNote: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 18 },
  securityText: { color: colors.muted, fontSize: 10, fontWeight: '600' },
});
