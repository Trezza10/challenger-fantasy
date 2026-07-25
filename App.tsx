import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';
import { AuthScreen } from './src/features/auth/AuthScreen';
import { AppNavigator } from './src/navigation/AppNavigator';
import { colors } from './src/theme/colors';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error('Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to the project .env file.');
}

/** Application entry point with encrypted Clerk session persistence. */
export default function App() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AuthenticatedApp />
    </ClerkProvider>
  );
}

/** Prevents protected app services and screens from mounting until Clerk confirms a session. */
function AuthenticatedApp() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  return isSignedIn ? <AppNavigator /> : <AuthScreen />;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center' },
});
