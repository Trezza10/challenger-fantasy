import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../theme/colors';
import { CreateLeaguePost } from '../../types/fantasy';
import { LoadingIndicator } from '../ui/LoadingIndicator';

export function LeaguePostComposer({ onClose, onPublish, visible }: { onClose: () => void; onPublish: (post: CreateLeaguePost) => Promise<void>; visible: boolean }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imagePosition, setImagePosition] = useState<'bottom' | 'top'>('top');
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!visible) { setTitle(''); setBody(''); setImageDataUrl(null); setImagePosition('top'); }
  }, [visible]);

  async function chooseImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Photo access needed', 'Allow photo access to attach an image to this post.');
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [16, 9],
      base64: true,
      mediaTypes: ['images'],
      quality: 0.5,
    });
    if (result.canceled) return;
    const encoded = result.assets[0].base64;
    if (!encoded) return Alert.alert('Unable to attach image', 'The selected image could not be converted for upload.');
    if (encoded.length > 2_700_000) return Alert.alert('Image too large', 'Choose a smaller image. Post images must be under 2 MB after compression.');
    setImageDataUrl(`data:image/jpeg;base64,${encoded}`);
  }

  async function publish() {
    if (title.trim().length < 3 || !body.trim()) return Alert.alert('Title and body required', 'Add a title and some post content.');
    setPublishing(true);
    try {
      await onPublish({
        body: body.trim(),
        title: title.trim(),
        ...(imageDataUrl ? { imageDataUrl, imagePosition } : {}),
      });
      onClose();
    } finally {
      setPublishing(false);
    }
  }

  return <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.header}><View><Text style={styles.eyebrow}>LEAGUE POST</Text><Text style={styles.heading}>Create a post</Text></View><Pressable onPress={onClose} style={styles.close}><Ionicons color={colors.text} name="close" size={21} /></Pressable></View>
        <TextInput maxLength={120} onChangeText={setTitle} placeholder="Post title" placeholderTextColor={colors.muted} style={styles.titleInput} value={title} />
        <TextInput maxLength={5000} multiline onChangeText={setBody} placeholder="Write your update…" placeholderTextColor={colors.muted} style={styles.bodyInput} textAlignVertical="top" value={body} />
        {imageDataUrl ? <View style={styles.imageCard}><Image resizeMode="cover" source={{ uri: imageDataUrl }} style={styles.preview} /><View style={styles.imageActions}><PositionButton active={imagePosition === 'top'} label="IMAGE AT TOP" onPress={() => setImagePosition('top')} /><PositionButton active={imagePosition === 'bottom'} label="IMAGE AT BOTTOM" onPress={() => setImagePosition('bottom')} /><Pressable onPress={() => setImageDataUrl(null)} style={styles.remove}><Ionicons color="#FF7878" name="trash-outline" size={17} /></Pressable></View></View> : <Pressable onPress={() => void chooseImage()} style={styles.addImage}><Ionicons color={colors.accent} name="image-outline" size={19} /><Text style={styles.addImageText}>ADD OPTIONAL IMAGE</Text></Pressable>}
        <Pressable disabled={publishing} onPress={() => void publish()} style={[styles.publish, publishing && styles.disabled]}>{publishing ? <LoadingIndicator size="small" /> : <Text style={styles.publishText}>PUBLISH TO LEAGUE</Text>}</Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}

function PositionButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.position, active && styles.activePosition]}><Text style={[styles.positionText, active && styles.activePositionText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  keyboard: { backgroundColor: colors.background, flex: 1 },
  screen: { gap: 13, padding: 20, paddingBottom: 36, paddingTop: 28 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  heading: { color: colors.text, fontSize: 27, fontWeight: '900', marginTop: 3 },
  close: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  titleInput: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 11, borderWidth: 1, color: colors.text, fontSize: 15, fontWeight: '800', minHeight: 48, paddingHorizontal: 13 },
  bodyInput: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 11, borderWidth: 1, color: colors.text, fontSize: 13, lineHeight: 20, minHeight: 190, padding: 13 },
  addImage: { alignItems: 'center', borderColor: colors.accent, borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 52 },
  addImageText: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: .6 },
  imageCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 11, borderWidth: 1, overflow: 'hidden' },
  preview: { aspectRatio: 16 / 9, width: '100%' },
  imageActions: { alignItems: 'center', flexDirection: 'row', gap: 7, padding: 9 },
  position: { borderColor: colors.border, borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 7 },
  activePosition: { backgroundColor: '#243614', borderColor: colors.accent },
  positionText: { color: colors.muted, fontSize: 8, fontWeight: '900' },
  activePositionText: { color: colors.accent },
  remove: { marginLeft: 'auto', padding: 6 },
  publish: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 10, minHeight: 46, justifyContent: 'center' },
  publishText: { color: colors.background, fontSize: 10, fontWeight: '900', letterSpacing: .7 },
  disabled: { opacity: .55 },
});
