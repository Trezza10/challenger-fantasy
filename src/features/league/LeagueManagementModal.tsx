import Ionicons from '@expo/vector-icons/Ionicons';
import { useUser } from '@clerk/expo';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { fantasyService } from '../../services/fantasy';
import { colors } from '../../theme/colors';
import { LeagueAccess, LeagueInvitation, LeagueSummary } from '../../types/fantasy';
import { LoadingIndicator } from '../ui/LoadingIndicator';

interface Props {
  onClose: () => void;
  onLeagueReady: (league: LeagueSummary) => void;
  selectedLeague: LeagueSummary | null;
  visible: boolean;
}

/** Create/join entry point plus commissioner invitation controls. */
export function LeagueManagementModal({ onClose, onLeagueReady, selectedLeague, visible }: Props) {
  const { user } = useUser();
  const [name, setName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [maxMembers, setMaxMembers] = useState('10');
  const [editedMaxMembers, setEditedMaxMembers] = useState('');
  const [joinValue, setJoinValue] = useState('');
  const [joinTeamName, setJoinTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [access, setAccess] = useState<LeagueAccess | null>(null);
  const [latestInvite, setLatestInvite] = useState<LeagueInvitation | null>(null);
  const [busyAction, setBusyAction] = useState<'access' | 'create' | 'invite' | 'join' | 'size' | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible || !selectedLeague) { setAccess(null); return; }
    setBusyAction('access');
    void fantasyService.getLeagueAccess(selectedLeague.id)
      .then((result) => { setAccess(result); setEditedMaxMembers(String(result.maxMembers)); })
      .catch(() => setAccess(null))
      .finally(() => setBusyAction(null));
  }, [selectedLeague, visible]);

  async function createLeague() {
    if (name.trim().length < 3 || teamName.trim().length < 3) return Alert.alert('Names required', 'Enter a league name and your team name.');
    const leagueSize = Number(maxMembers);
    if (!Number.isInteger(leagueSize) || leagueSize < 2 || leagueSize > 20) return Alert.alert('League size required', 'Choose between 2 and 20 managers.');
    setBusyAction('create');
    try {
      const result = await fantasyService.createLeague(name.trim(), teamName.trim(), leagueSize, displayNameFor(user), user?.primaryEmailAddress?.emailAddress);
      onLeagueReady(toSummary(result));
      setAccess(result);
      setName('');
      setTeamName('');
      Alert.alert('League created', `You are the commissioner of ${result.name}.`);
    } catch (error) {
      Alert.alert('Unable to create league', messageFor(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function updateLeagueSize() {
    if (!selectedLeague || !access?.isCommissioner) return;
    const leagueSize = Number(editedMaxMembers);
    if (!Number.isInteger(leagueSize) || leagueSize < access.memberCount || leagueSize > 20)
      return Alert.alert('Invalid league size', `Choose between ${access.memberCount} and 20 managers.`);
    setBusyAction('size');
    try {
      await fantasyService.updateLeagueSize(selectedLeague.id, leagueSize);
      setAccess({ ...access, maxMembers: leagueSize });
      Alert.alert('League size updated', `This league now has ${leagueSize} manager spots.`);
    } catch (error) {
      Alert.alert('Unable to update league size', messageFor(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function joinLeague(value = joinValue) {
    const credential = extractJoinCredential(value);
    if (!credential) return Alert.alert('Join code required', 'Paste a join code or invitation link.');
    setBusyAction('join');
    try {
      if (joinTeamName.trim().length < 3) return Alert.alert('Team name required', 'Enter the name your team will use in this league.');
      const result = await fantasyService.joinLeague(credential, joinTeamName.trim(), displayNameFor(user), user?.primaryEmailAddress?.emailAddress);
      onLeagueReady(toSummary(result));
      setJoinValue('');
      setJoinTeamName('');
      onClose();
      Alert.alert('League joined', `Welcome to ${result.name}.`);
    } catch (error) {
      Alert.alert('Unable to join league', messageFor(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function createInvitation() {
    if (!selectedLeague || !access?.isCommissioner) return;
    setBusyAction('invite');
    try {
      const invitation = await fantasyService.createLeagueInvitation(selectedLeague.id, inviteEmail.trim() || undefined);
      setLatestInvite(invitation);
      if (inviteEmail.trim()) {
        const subject = encodeURIComponent(`Join ${selectedLeague.name} on Challengers Fantasy`);
        const body = encodeURIComponent(`You've been invited to ${selectedLeague.name}.\n\nOpen this link on your phone:\n${invitation.inviteUrl}\n\nOr enter join code: ${access.joinCode}`);
        await Linking.openURL(`mailto:${encodeURIComponent(inviteEmail.trim())}?subject=${subject}&body=${body}`);
      } else {
        await shareInvitation(invitation, access);
      }
    } catch (error) {
      Alert.alert('Unable to create invitation', messageFor(error));
    } finally {
      setBusyAction(null);
    }
  }

  return <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
    <ScrollView contentContainerStyle={styles.screen} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" ref={scrollRef}>
      <View style={styles.header}><View><Text style={styles.eyebrow}>LEAGUE ACCESS</Text><Text style={styles.title}>Create or join</Text></View><Pressable onPress={onClose} style={styles.close}><Ionicons color={colors.text} name="close" size={22} /></Pressable></View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>CREATE A LEAGUE</Text>
        <Text style={styles.copy}>You’ll become the commissioner and can invite other managers.</Text>
        <TextInput autoCapitalize="words" maxLength={80} onChangeText={setName} placeholder="League name" placeholderTextColor={colors.muted} style={styles.input} value={name} />
        <TextInput autoCapitalize="words" maxLength={80} onChangeText={setTeamName} placeholder="Your team name" placeholderTextColor={colors.muted} style={styles.input} value={teamName} />
        <TextInput keyboardType="number-pad" maxLength={2} onChangeText={setMaxMembers} placeholder="Number of managers" placeholderTextColor={colors.muted} style={styles.input} value={maxMembers} />
        <Text style={styles.inputHint}>Matchups stay locked until all manager spots are filled and the draft is complete.</Text>
        <ActionButton busy={busyAction === 'create'} label="CREATE LEAGUE" onPress={createLeague} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>JOIN A LEAGUE</Text>
        <Text style={styles.copy}>Paste an eight-character code or a complete invitation link.</Text>
        <TextInput autoCapitalize="characters" autoCorrect={false} onChangeText={setJoinValue} placeholder="Join code or link" placeholderTextColor={colors.muted} style={styles.input} value={joinValue} />
        <TextInput autoCapitalize="words" maxLength={80} onChangeText={setJoinTeamName} placeholder="Your team name" placeholderTextColor={colors.muted} style={styles.input} value={joinTeamName} />
        <ActionButton busy={busyAction === 'join'} label="JOIN LEAGUE" onPress={() => void joinLeague()} />
      </View>

      {selectedLeague && (busyAction === 'access' ? <LoadingIndicator /> : access?.isCommissioner && <View style={[styles.card, styles.commissionerCard]}>
        <View style={styles.commissionerHeading}><Ionicons color={colors.accent} name="shield-checkmark" size={20} /><View><Text style={styles.cardTitle}>COMMISSIONER TOOLS</Text><Text style={styles.leagueName}>{selectedLeague.name}</Text></View></View>
        <Text style={styles.codeLabel}>JOIN CODE</Text><Text selectable style={styles.code}>{access.joinCode}</Text>
        <Text style={styles.codeLabel}>LEAGUE SIZE · {access.memberCount}/{access.maxMembers} JOINED</Text>
        <View style={styles.inlineSetting}><TextInput keyboardType="number-pad" maxLength={2} onChangeText={setEditedMaxMembers} placeholder="Manager spots" placeholderTextColor={colors.muted} style={[styles.input, styles.inlineInput]} value={editedMaxMembers} /><ActionButton busy={busyAction === 'size'} label="UPDATE" onPress={updateLeagueSize} /></View>
        <Pressable onPress={() => void Share.share({ message: `Join ${selectedLeague.name} on Challengers Fantasy with code ${access.joinCode}` })} style={styles.secondaryButton}><Ionicons color={colors.accent} name="share-outline" size={16} /><Text style={styles.secondaryButtonText}>SHARE JOIN CODE</Text></Pressable>
        <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="email-address" onChangeText={setInviteEmail} onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 180)} placeholder="Manager email (optional)" placeholderTextColor={colors.muted} style={styles.input} value={inviteEmail} />
        <ActionButton busy={busyAction === 'invite'} label={inviteEmail.trim() ? 'CREATE EMAIL INVITE' : 'CREATE & SHARE LINK'} onPress={createInvitation} />
        {latestInvite && <Text selectable style={styles.inviteLink}>{latestInvite.inviteUrl}</Text>}
      </View>)}
    </ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}

function ActionButton({ busy, label, onPress }: { busy: boolean; label: string; onPress: () => void }) {
  return <Pressable disabled={busy} onPress={onPress} style={[styles.action, busy && styles.disabled]}>{busy ? <LoadingIndicator size="small" /> : <Text style={styles.actionText}>{label}</Text>}</Pressable>;
}

async function shareInvitation(invitation: LeagueInvitation, access: LeagueAccess) {
  await Share.share({ message: `Join ${access.name} on Challengers Fantasy.\n${invitation.inviteUrl}\nJoin code: ${access.joinCode}` });
}

function extractJoinCredential(value: string) {
  const trimmed = value.trim();
  if (!trimmed.includes('://')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.searchParams.get('token') ?? parsed.searchParams.get('code') ?? '';
  } catch {
    return '';
  }
}

function toSummary(access: LeagueAccess): LeagueSummary {
  return { id: access.leagueId, maxMembers: access.maxMembers, memberCount: access.memberCount, name: access.name };
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : 'Please try again.';
}

function displayNameFor(user: ReturnType<typeof useUser>['user']) {
  return user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Manager';
}

const styles = StyleSheet.create({
  keyboardView: { backgroundColor: colors.background, flex: 1 },
  screen: { backgroundColor: colors.background, flexGrow: 1, gap: 16, padding: 20, paddingBottom: 36, paddingTop: 28 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 3 },
  close: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 15, borderWidth: 1, padding: 15 },
  commissionerCard: { borderColor: '#456921' },
  cardTitle: { color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: .8 },
  copy: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 5 },
  input: { backgroundColor: '#101716', borderColor: colors.border, borderRadius: 9, borderWidth: 1, color: colors.text, fontSize: 13, height: 44, marginTop: 12, paddingHorizontal: 11 },
  inputHint: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 8 },
  inlineSetting: { alignItems: 'flex-end', flexDirection: 'row', gap: 8 },
  inlineInput: { flex: 1 },
  action: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 9, height: 42, justifyContent: 'center', marginTop: 10 },
  actionText: { color: colors.background, fontSize: 10, fontWeight: '900', letterSpacing: .7 },
  disabled: { opacity: .6 },
  commissionerHeading: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  leagueName: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  codeLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: .8, marginTop: 15 },
  code: { color: colors.accent, fontSize: 24, fontWeight: '900', letterSpacing: 3, marginTop: 3 },
  secondaryButton: { alignItems: 'center', borderColor: colors.accent, borderRadius: 9, borderWidth: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', marginTop: 10, paddingVertical: 10 },
  secondaryButtonText: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: .6 },
  inviteLink: { color: colors.textSecondary, fontSize: 10, lineHeight: 15, marginTop: 10 },
});
