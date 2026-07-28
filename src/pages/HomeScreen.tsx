import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ServiceState } from '../features/ui/ServiceState';
import { useServiceData } from '../hooks/useServiceData';
import { fantasyService } from '../services/fantasy';
import { colors } from '../theme/colors';
import { CreateLeaguePost, LeaguePost, LeagueSummary, NewsStory } from '../types/fantasy';
import { SwipeBackView } from '../features/ui/SwipeBackView';
import { LeaguePostComposer } from '../features/league/LeaguePostComposer';

/** Landing page with current manager context and tappable league news. */
export function HomeScreen({ onRegisterRefresh, selectedLeague }: { onRegisterRefresh: (refresh: () => Promise<void>) => () => void; selectedLeague: LeagueSummary | null }) {
  const { data, error, isLoading, refetch } = useServiceData(fantasyService.getHome);
  const loadLeaguePosts = useCallback(() => fantasyService.getLeaguePosts(selectedLeague?.id ?? 'challengers'), [selectedLeague?.id]);
  const postsRequest = useServiceData(loadLeaguePosts, `home-league-posts:${selectedLeague?.id ?? 'challengers'}`);
  const [selectedStory, setSelectedStory] = useState<NewsStory | null>(null);
  const [selectedLeaguePost, setSelectedLeaguePost] = useState<LeaguePost | null>(null);
  const [isComposing, setIsComposing] = useState(false);

  /** Lets the app-level pull gesture refresh the data currently shown on this page. */
  useEffect(() => onRegisterRefresh(async () => { await Promise.all([refetch(), postsRequest.refetch()]); }), [onRegisterRefresh, postsRequest.refetch, refetch]);
  if (!data) return <ServiceState error={error} isLoading={isLoading} />;

  if (selectedLeaguePost) return <LeaguePostArticle onBack={() => setSelectedLeaguePost(null)} post={selectedLeaguePost} />;
  if (selectedStory) return <NewsArticle onBack={() => setSelectedStory(null)} story={selectedStory} />;

  async function publish(post: CreateLeaguePost) {
    if (!selectedLeague) return;
    try {
      await fantasyService.createLeaguePost(selectedLeague.id, post);
      await postsRequest.refetch();
    } catch (publishError) {
      Alert.alert('Unable to publish post', publishError instanceof Error ? publishError.message : 'Please try again.');
      throw publishError;
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.newsHeader}><View><Text style={styles.sectionTitle}>LEAGUE POSTS</Text><Text style={styles.sectionSubtitle}>{selectedLeague?.name ?? 'CURRENT LEAGUE'}</Text></View><Pressable onPress={() => setIsComposing(true)} style={styles.createButton}><Ionicons color={colors.background} name="create-outline" size={15} /><Text style={styles.createButtonText}>CREATE POST</Text></Pressable></View>
      {postsRequest.data?.length === 0 && <View style={styles.emptyPosts}><Ionicons color={colors.accent} name="newspaper-outline" size={24} /><Text style={styles.emptyTitle}>No league posts yet</Text><Text style={styles.emptyCopy}>Share an announcement, recap, or league update.</Text></View>}
      {postsRequest.data?.map((post) => <LeaguePostCard key={post.id} onPress={() => setSelectedLeaguePost(post)} post={post} />)}
      <View style={[styles.newsHeader, styles.communityHeader]}><View><Text style={styles.sectionTitle}>COMMUNITY POSTS</Text><Text style={styles.sectionSubtitle}>JOURNALISTS · TEAMS · LEAGUE NEWS</Text></View><Text style={styles.sectionMeta}>LATEST</Text></View>
      {data.news.map((story) => <Pressable key={story.id} onPress={() => setSelectedStory(story)} style={styles.newsCard}><Text style={styles.category}>{story.category}</Text><Text style={styles.newsTitle}>{story.title}</Text><Text numberOfLines={2} style={styles.summary}>{story.summary}</Text><View style={styles.newsFooter}><Text style={styles.time}>{formatPublishedAt(story.publishedAt)}</Text><Ionicons color={colors.accent} name="arrow-forward" size={16} /></View></Pressable>)}
      {data.news.length === 0 && <View style={styles.emptyPosts}><Ionicons color={colors.muted} name="globe-outline" size={24} /><Text style={styles.emptyTitle}>No community posts yet</Text><Text style={styles.emptyCopy}>Journalist and team stories will appear here.</Text></View>}
      <LeaguePostComposer onClose={() => setIsComposing(false)} onPublish={publish} visible={isComposing} />
    </View>
  );
}

function LeaguePostCard({ onPress, post }: { onPress: () => void; post: LeaguePost }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.leaguePostSummary, pressed && styles.pressedPost]}>
    <View style={styles.summaryCopy}><Text style={styles.category}>{post.authorName.toUpperCase()} · {new Date(post.createdAt).toLocaleString()}</Text><Text style={styles.newsTitle}>{post.title}</Text></View>
    <Ionicons color={colors.accent} name="arrow-forward" size={17} />
  </Pressable>;
}

function LeaguePostArticle({ onBack, post }: { onBack: () => void; post: LeaguePost }) {
  const image = post.imageDataUrl ? <Image resizeMode="cover" source={{ uri: post.imageDataUrl }} style={styles.articleImage} /> : null;
  return <SwipeBackView onBack={onBack} style={styles.article}>
    <Pressable onPress={onBack} style={styles.backButton}><Ionicons color={colors.accent} name="arrow-back" size={19} /><Text style={styles.backText}>BACK TO HOME</Text></Pressable>
    <Text style={styles.category}>LEAGUE POST · {post.authorName.toUpperCase()}</Text>
    <Text style={styles.articleTitle}>{post.title}</Text>
    <Text style={styles.time}>{new Date(post.createdAt).toLocaleString()}</Text>
    {post.imagePosition === 'top' && image}
    <Text style={styles.articleBody}>{post.body}</Text>
    {post.imagePosition === 'bottom' && image}
  </SwipeBackView>;
}

function formatPublishedAt(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

/** Full article view displayed after selecting a story from the Home feed. */
function NewsArticle({ onBack, story }: { onBack: () => void; story: NewsStory }) {
  return <SwipeBackView onBack={onBack} style={styles.article}><Pressable onPress={onBack} style={styles.backButton}><Ionicons color={colors.accent} name="arrow-back" size={19} /><Text style={styles.backText}>BACK TO HOME</Text></Pressable><Text style={styles.category}>{story.category}</Text><Text style={styles.articleTitle}>{story.title}</Text><Text style={styles.time}>{formatPublishedAt(story.publishedAt)}</Text><Text style={styles.articleBody}>{story.body}</Text></SwipeBackView>;
}

const styles = StyleSheet.create({
  screen: { gap: 16 },
  text: { color: '#BBC5C3', fontSize: 14, lineHeight: 21 },
  newsHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  sectionSubtitle: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: .6, marginTop: 3 },
  sectionTitle: { color: colors.text, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  sectionMeta: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  createButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 8, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  createButtonText: { color: colors.background, fontSize: 8, fontWeight: '900', letterSpacing: .5 },
  communityHeader: { marginTop: 12 },
  emptyPosts: { alignItems: 'center', backgroundColor: '#0E1514', borderColor: colors.border, borderRadius: 14, borderWidth: 1, padding: 20 },
  emptyTitle: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 8 },
  emptyCopy: { color: colors.textSecondary, fontSize: 10, marginTop: 4 },
  leaguePostSummary: { alignItems: 'center', backgroundColor: '#0E1514', borderColor: colors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', minHeight: 78, padding: 15 },
  pressedPost: { opacity: .7 },
  summaryCopy: { flex: 1, paddingRight: 12 },
  articleImage: { aspectRatio: 16 / 9, borderRadius: 14, marginVertical: 8, width: '100%' },
  newsCard: { backgroundColor: '#0E1514', borderColor: colors.border, borderRadius: 14, borderWidth: 1, padding: 16 },
  category: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  newsTitle: { color: colors.text, fontSize: 17, fontWeight: '800', lineHeight: 22, marginTop: 7 },
  summary: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 7 },
  newsFooter: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 13 },
  time: { color: '#85928F', fontSize: 11, fontWeight: '700' },
  article: { gap: 12 },
  backButton: { alignItems: 'center', flexDirection: 'row', gap: 7, marginBottom: 8 },
  backText: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  articleTitle: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4, lineHeight: 34 },
  articleBody: { color: colors.textSecondary, fontSize: 15, lineHeight: 24, marginTop: 10 },
});
