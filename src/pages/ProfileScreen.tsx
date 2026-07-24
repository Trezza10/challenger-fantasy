import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ServiceState } from '../features/ui/ServiceState';
import { useServiceData } from '../hooks/useServiceData';
import { fantasyService } from '../services/fantasy';
import { colors } from '../theme/colors';
import { getAvatarUrl } from '../utils/formatters';

/** Manager account page with mock-backed profile and security settings. */
export function ProfileScreen({ onRegisterRefresh }: { onRegisterRefresh: (refresh: () => Promise<void>) => () => void }) {
  const { data, error, isLoading, refetch } = useServiceData(fantasyService.getProfile);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  /** Pull-to-refresh rehydrates account details from the currently active service. */
  useEffect(() => onRegisterRefresh(refetch), [onRegisterRefresh, refetch]);
  /** Keeps editable fields aligned with profile refreshes and initial data arrival. */
  useEffect(() => { if (data) { setUsername(data.username); setEmail(data.email); setAvatarUrl(data.avatarUrl); } }, [data]);
  if (!data) return <ServiceState error={error} isLoading={isLoading} />;

  async function saveProfile() {
    if (!username.trim() || !email.includes('@')) { setNotice('Enter a username and valid email address.'); return; }
    setIsSaving(true);
    try {
      await fantasyService.updateProfile({ avatarUrl, email: email.trim(), username: username.trim() });
      setNotice('Profile saved.');
      await refetch();
    } catch { setNotice('Unable to save profile. Try again.'); }
    finally { setIsSaving(false); }
  }

  async function savePassword() {
    if (newPassword.length < 8) { setNotice('Use at least 8 characters for your new password.'); return; }
    if (newPassword !== confirmPassword) { setNotice('New passwords do not match.'); return; }
    setIsSaving(true);
    try {
      await fantasyService.updatePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setNotice('Password updated.');
    } catch { setNotice('Unable to update password. Check your current password.'); }
    finally { setIsSaving(false); }
  }

  return <View style={styles.screen}>
    <View style={styles.hero}><Image source={{ uri: avatarUrl || getAvatarUrl(username || data.name) }} style={styles.avatar} /><View style={styles.heroCopy}><Text style={styles.name}>{username || data.name}</Text><Text style={styles.member}>MEMBER SINCE {data.memberSince}</Text></View></View>
    <SettingsCard icon="person-outline" title="PROFILE">
      <Field label="USERNAME" onChangeText={setUsername} value={username} />
      <Field keyboardType="email-address" label="EMAIL" onChangeText={setEmail} value={email} />
      <Text style={styles.fieldLabel}>AVATAR</Text><View style={styles.avatarChoices}>{['Manager', 'Captain', 'Maverick', 'Rival'].map((seed) => { const url = getAvatarUrl(seed); return <Pressable key={seed} onPress={() => setAvatarUrl(url)} style={[styles.avatarChoice, avatarUrl === url && styles.selectedAvatar]}><Image source={{ uri: url }} style={styles.choiceImage} /></Pressable>; })}</View>
      <Pressable disabled={isSaving} onPress={saveProfile} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{isSaving ? 'SAVING…' : 'SAVE PROFILE'}</Text></Pressable>
    </SettingsCard>
    <SettingsCard icon="lock-closed-outline" title="PASSWORD & SECURITY">
      <Field label="CURRENT PASSWORD" onChangeText={setCurrentPassword} secureTextEntry value={currentPassword} />
      <Field label="NEW PASSWORD" onChangeText={setNewPassword} secureTextEntry value={newPassword} />
      <Field label="CONFIRM NEW PASSWORD" onChangeText={setConfirmPassword} secureTextEntry value={confirmPassword} />
      <Pressable disabled={isSaving} onPress={savePassword} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>UPDATE PASSWORD</Text></Pressable>
    </SettingsCard>
    {!!notice && <Text style={styles.notice}>{notice}</Text>}
  </View>;
}

/** Consistent labeled account input that avoids repeating input styling. */
function Field({ keyboardType, label, onChangeText, secureTextEntry, value }: { keyboardType?: 'email-address'; label: string; onChangeText: (value: string) => void; secureTextEntry?: boolean; value: string }) {
  return <View><Text style={styles.fieldLabel}>{label}</Text><TextInput autoCapitalize="none" keyboardType={keyboardType} onChangeText={onChangeText} placeholderTextColor={colors.muted} secureTextEntry={secureTextEntry} style={styles.input} value={value} /></View>;
}

/** Settings grouping with a small icon to mirror the League utility cards. */
function SettingsCard({ children, icon, title }: { children: React.ReactNode; icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return <View style={styles.card}><View style={styles.cardTitle}><Ionicons color={colors.accent} name={icon} size={18} /><Text style={styles.cardTitleText}>{title}</Text></View>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { gap: 14 },
  hero: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', padding: 16 },
  avatar: { backgroundColor: '#29565B', borderColor: colors.accent, borderRadius: 36, borderWidth: 1, height: 72, width: 72 },
  heroCopy: { marginLeft: 13 }, name: { color: colors.text, fontSize: 20, fontWeight: '900' }, member: { color: colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: .8, marginTop: 5 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: 11, padding: 15 }, cardTitle: { alignItems: 'center', flexDirection: 'row', gap: 7, marginBottom: 3 }, cardTitleText: { color: colors.text, fontSize: 12, fontWeight: '900', letterSpacing: .8 },
  fieldLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: .8, marginTop: 3 }, input: { backgroundColor: '#101516', borderColor: colors.border, borderRadius: 8, borderWidth: 1, color: colors.text, fontSize: 13, height: 40, marginTop: 5, paddingHorizontal: 10 },
  avatarChoices: { flexDirection: 'row', gap: 10 }, avatarChoice: { borderColor: colors.border, borderRadius: 21, borderWidth: 1, padding: 2 }, selectedAvatar: { borderColor: colors.accent }, choiceImage: { backgroundColor: '#29565B', borderRadius: 17, height: 34, width: 34 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 8, marginTop: 5, paddingVertical: 10 }, primaryButtonText: { color: colors.background, fontSize: 10, fontWeight: '900', letterSpacing: .8 }, secondaryButton: { alignItems: 'center', borderColor: colors.accent, borderRadius: 8, borderWidth: 1, marginTop: 5, paddingVertical: 10 }, secondaryButtonText: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  notice: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', paddingHorizontal: 3, textAlign: 'center' },
});
