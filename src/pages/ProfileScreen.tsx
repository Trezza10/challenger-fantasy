import Ionicons from '@expo/vector-icons/Ionicons';
import { useClerk, useUser } from '@clerk/expo';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LoadingIndicator } from '../features/ui/LoadingIndicator';
import { colors } from '../theme/colors';

/** Account settings backed by the currently authenticated Clerk user. */
export function ProfileScreen({ onRegisterRefresh }: { onRegisterRefresh: (refresh: () => Promise<void>) => () => void }) {
  const { signOut } = useClerk();
  const { isLoaded, user } = useUser();
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [avatarRevision, setAvatarRevision] = useState(0);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  /** Pull-to-refresh retrieves current account attributes directly from Clerk. */
  const refreshProfile = useCallback(async () => {
    await user?.reload();
  }, [user]);

  useEffect(() => onRegisterRefresh(refreshProfile), [onRegisterRefresh, refreshProfile]);
  useEffect(() => {
    if (user) setUsername(user.username ?? '');
  }, [user]);

  if (!isLoaded || !user) {
    return <View style={styles.loading}><LoadingIndicator /></View>;
  }

  const clerkUser = user;
  const email = user.primaryEmailAddress?.emailAddress ?? 'No email address';
  const emailVerified = user.primaryEmailAddress?.verification.status === 'verified';
  const memberSince = user.createdAt
    ? user.createdAt.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }).toUpperCase()
    : 'RECENTLY';
  const avatarUrl = avatarRevision
    ? `${user.imageUrl}${user.imageUrl.includes('?') ? '&' : '?'}v=${avatarRevision}`
    : user.imageUrl;

  async function saveProfile() {
    const nextUsername = username.trim();
    if (!nextUsername) {
      setNotice('Enter a manager username.');
      return;
    }

    setIsSavingProfile(true);
    setNotice('');
    try {
      await clerkUser.update({ username: nextUsername });
      setNotice('Manager profile updated.');
    } catch (error) {
      setNotice(formatClerkError(error));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function chooseAvatar() {
    setNotice('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo access in your device settings to choose a manager avatar.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled) return;

    setIsUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      if (!asset.uri) {
        throw new Error('The selected photo could not be read.');
      }

      const mimeType = asset.mimeType || inferImageMimeType(asset.uri);
      if (!mimeType.startsWith('image/')) {
        throw new Error('The selected file is not a supported image.');
      }

      // Clerk's native client builds this request with React Native's FormData.
      // RN requires its `{ uri, name, type }` descriptor to serialize a local file
      // as a binary multipart part; web/Expo Blob objects become plain text here.
      const uploadFile = {
        name: `avatar.${imageExtensionForMimeType(mimeType)}`,
        type: mimeType,
        uri: asset.uri,
      } as unknown as Blob;
      await clerkUser.setProfileImage({ file: uploadFile });
      await clerkUser.reload();
      setAvatarRevision(Date.now());
      setNotice('Profile photo updated.');
    } catch (error) {
      setNotice(formatClerkError(error));
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function savePassword() {
    if (!currentPassword) {
      setNotice('Enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setNotice('Use at least 8 characters for your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice('New passwords do not match.');
      return;
    }

    setIsSavingPassword(true);
    setNotice('');
    try {
      await clerkUser.updatePassword({
        currentPassword,
        newPassword,
        signOutOfOtherSessions: true,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice('Password updated. Other signed-in devices were logged out.');
    } catch (error) {
      setNotice(formatClerkError(error));
    } finally {
      setIsSavingPassword(false);
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You will need to sign in again to manage your team.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Pressable
          accessibilityLabel="Choose a new profile photo"
          accessibilityRole="button"
          disabled={isUploadingAvatar}
          onPress={chooseAvatar}
          style={({ pressed }) => [styles.avatarButton, pressed && styles.avatarPressed]}
        >
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          <View style={styles.avatarEditBadge}>
            {isUploadingAvatar
              ? <ActivityIndicator color={colors.background} size="small" />
              : <Ionicons color={colors.background} name="camera" size={14} />}
          </View>
        </Pressable>
        <View style={styles.heroCopy}>
          <Text numberOfLines={1} style={styles.name}>@{user.username ?? 'manager'}</Text>
          <Text numberOfLines={1} style={styles.heroEmail}>{email}</Text>
          <Text style={styles.member}>MEMBER SINCE {memberSince}</Text>
          <Pressable disabled={isUploadingAvatar} onPress={chooseAvatar} style={styles.changePhotoButton}>
            <Text style={styles.changePhotoText}>{isUploadingAvatar ? 'UPLOADING…' : 'CHANGE PHOTO'}</Text>
          </Pressable>
        </View>
      </View>

      <SettingsCard icon="person-outline" title="MANAGER PROFILE">
        <Field
          autoComplete="username"
          label="USERNAME"
          onChangeText={setUsername}
          placeholder="Manager username"
          value={username}
        />
        <Text style={styles.helper}>This is your public manager name across Challengers Fantasy.</Text>
        <Pressable disabled={isSavingProfile || username.trim() === user.username} onPress={saveProfile} style={[styles.primaryButton, (isSavingProfile || username.trim() === user.username) && styles.disabled]}>
          <Text style={styles.primaryButtonText}>{isSavingProfile ? 'SAVING…' : 'SAVE USERNAME'}</Text>
        </Pressable>
      </SettingsCard>

      <SettingsCard icon="mail-outline" title="ACCOUNT EMAIL">
        <View style={styles.readOnlyField}>
          <View style={styles.readOnlyCopy}>
            <Text style={styles.fieldLabel}>PRIMARY EMAIL</Text>
            <Text numberOfLines={1} style={styles.readOnlyValue}>{email}</Text>
          </View>
          <View style={[styles.statusBadge, emailVerified && styles.verifiedBadge]}>
            <Ionicons color={emailVerified ? colors.accent : '#FFD166'} name={emailVerified ? 'checkmark-circle' : 'alert-circle'} size={14} />
            <Text style={[styles.statusBadgeText, emailVerified && styles.verifiedBadgeText]}>{emailVerified ? 'VERIFIED' : 'UNVERIFIED'}</Text>
          </View>
        </View>
        <Text style={styles.helper}>Your sign-in email is protected by Clerk verification.</Text>
      </SettingsCard>

      {user.passwordEnabled && (
        <SettingsCard icon="lock-closed-outline" title="PASSWORD & SECURITY">
          <SecurityRow enabled icon="key-outline" label="Password authentication" />
          <SecurityRow enabled={user.twoFactorEnabled} icon="shield-checkmark-outline" label="Two-factor authentication" />
          <View style={styles.divider} />
          <Field autoComplete="current-password" label="CURRENT PASSWORD" onChangeText={setCurrentPassword} secureTextEntry value={currentPassword} />
          <Field autoComplete="new-password" label="NEW PASSWORD" onChangeText={setNewPassword} secureTextEntry value={newPassword} />
          <Field autoComplete="new-password" label="CONFIRM NEW PASSWORD" onChangeText={setConfirmPassword} secureTextEntry value={confirmPassword} />
          <Pressable disabled={isSavingPassword} onPress={savePassword} style={[styles.secondaryButton, isSavingPassword && styles.disabled]}>
            <Text style={styles.secondaryButtonText}>{isSavingPassword ? 'UPDATING…' : 'UPDATE PASSWORD'}</Text>
          </Pressable>
        </SettingsCard>
      )}

      {!!notice && (
        <View style={styles.noticeBox}>
          <Ionicons color={colors.accent} name="information-circle-outline" size={16} />
          <Text style={styles.notice}>{notice}</Text>
        </View>
      )}

      <Pressable accessibilityRole="button" onPress={confirmSignOut} style={styles.signOutButton}>
        <Ionicons color="#FF8C8C" name="log-out-outline" size={17} />
        <Text style={styles.signOutButtonText}>SIGN OUT</Text>
      </Pressable>
    </View>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        autoCapitalize="none"
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        style={styles.input}
      />
    </View>
  );
}

function SecurityRow({ enabled, icon, label }: { enabled: boolean; icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.securityRow}>
      <View style={styles.securityLabel}>
        <Ionicons color={colors.textSecondary} name={icon} size={17} />
        <Text style={styles.securityText}>{label}</Text>
      </View>
      <Text style={[styles.securityState, enabled && styles.securityStateEnabled]}>{enabled ? 'ON' : 'OFF'}</Text>
    </View>
  );
}

/** Settings grouping with a small icon to mirror the League utility cards. */
function SettingsCard({ children, icon, title }: { children: React.ReactNode; icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTitle}>
        <Ionicons color={colors.accent} name={icon} size={18} />
        <Text style={styles.cardTitleText}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function formatClerkError(error: unknown) {
  if (typeof error === 'object' && error) {
    const clerkError = error as {
      errors?: { longMessage?: string; message?: string }[];
      message?: string;
    };
    const detail = clerkError.errors?.[0];
    if (detail?.longMessage || detail?.message) return detail.longMessage ?? detail.message ?? 'Unable to update your account.';
    if (clerkError.message) return clerkError.message;
  }
  return 'Unable to update your account. Try again.';
}

function inferImageMimeType(uri: string) {
  const extension = uri.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic' || extension === 'heif') return 'image/heic';
  return 'image/jpeg';
}

function imageExtensionForMimeType(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic' || mimeType === 'image/heif') return 'heic';
  return 'jpg';
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', minHeight: 280, justifyContent: 'center' },
  screen: { gap: 14 },
  hero: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', padding: 16 },
  avatarButton: { borderRadius: 36 },
  avatarPressed: { opacity: .75 },
  avatar: { backgroundColor: '#29565B', borderColor: colors.accent, borderRadius: 36, borderWidth: 1, height: 72, width: 72 },
  avatarEditBadge: { alignItems: 'center', backgroundColor: colors.accent, borderColor: colors.card, borderRadius: 13, borderWidth: 3, bottom: -1, height: 26, justifyContent: 'center', position: 'absolute', right: -2, width: 26 },
  heroCopy: { flex: 1, marginLeft: 13 },
  name: { color: colors.text, fontSize: 20, fontWeight: '900' },
  heroEmail: { color: colors.textSecondary, fontSize: 11, marginTop: 3 },
  member: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: .8, marginTop: 6 },
  changePhotoButton: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 2 },
  changePhotoText: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: 11, padding: 15 },
  cardTitle: { alignItems: 'center', flexDirection: 'row', gap: 7, marginBottom: 3 },
  cardTitleText: { color: colors.text, fontSize: 12, fontWeight: '900', letterSpacing: .8 },
  fieldLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: .8, marginTop: 3 },
  input: { backgroundColor: '#101516', borderColor: colors.border, borderRadius: 8, borderWidth: 1, color: colors.text, fontSize: 13, height: 42, marginTop: 5, paddingHorizontal: 10 },
  helper: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 8, marginTop: 2, paddingVertical: 11 },
  primaryButtonText: { color: colors.background, fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  disabled: { opacity: .45 },
  readOnlyField: { alignItems: 'center', backgroundColor: '#101516', borderColor: colors.border, borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'space-between', padding: 11 },
  readOnlyCopy: { flex: 1 },
  readOnlyValue: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 5 },
  statusBadge: { alignItems: 'center', backgroundColor: '#2B261A', borderRadius: 12, flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingVertical: 5 },
  verifiedBadge: { backgroundColor: '#1A2A21' },
  statusBadgeText: { color: '#FFD166', fontSize: 8, fontWeight: '900', letterSpacing: .5 },
  verifiedBadgeText: { color: colors.accent },
  securityRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  securityLabel: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  securityText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  securityState: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  securityStateEnabled: { color: colors.accent },
  divider: { backgroundColor: colors.border, height: 1, marginVertical: 3 },
  secondaryButton: { alignItems: 'center', borderColor: colors.accent, borderRadius: 8, borderWidth: 1, marginTop: 5, paddingVertical: 11 },
  secondaryButtonText: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  noticeBox: { alignItems: 'center', backgroundColor: '#17221F', borderColor: '#304138', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 8, padding: 11 },
  notice: { color: colors.textSecondary, flex: 1, fontSize: 11, fontWeight: '700', lineHeight: 16 },
  signOutButton: { alignItems: 'center', borderColor: '#593534', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', paddingVertical: 12 },
  signOutButtonText: { color: '#FF8C8C', fontSize: 10, fontWeight: '900', letterSpacing: .8 },
});
