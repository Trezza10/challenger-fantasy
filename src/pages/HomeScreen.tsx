import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../features/ui/Card';
import { ServiceState } from '../features/ui/ServiceState';
import { Stat } from '../features/ui/Stat';
import { useServiceData } from '../hooks/useServiceData';
import { fantasyService } from '../services/fantasy';
import { colors } from '../theme/colors';
import { NewsStory } from '../types/fantasy';
import { formatPoints } from '../utils/formatters';

/** Landing page with current manager context and tappable league news. */
export function HomeScreen({ onRegisterRefresh }: { onRegisterRefresh: (refresh: () => Promise<void>) => () => void }) {
  const { data, error, isLoading, refetch } = useServiceData(fantasyService.getHome);
  const [selectedStory, setSelectedStory] = useState<NewsStory | null>(null);

  /** Lets the app-level pull gesture refresh the data currently shown on this page. */
  useEffect(() => onRegisterRefresh(refetch), [onRegisterRefresh, refetch]);
  if (!data) return <ServiceState error={error} isLoading={isLoading} />;

  if (selectedStory) return <NewsArticle onBack={() => setSelectedStory(null)} story={selectedStory} />;

  return (
    <View style={styles.screen}>
      {/* <Card title="WELCOME BACK, MANAGER"><Text style={styles.text}>{data.welcomeMessage}</Text></Card>
      <Card title="THIS WEEK"><Stat label="Projected points" value={formatPoints(data.projectedPoints)} /><Stat label="League rank" value={data.leagueRank} /></Card> */}
      <View style={styles.newsHeader}><Text style={styles.sectionTitle}>LEAGUE NEWS</Text><Text style={styles.sectionMeta}>LATEST</Text></View>
      {data.news.map((story) => <Pressable key={story.id} onPress={() => setSelectedStory(story)} style={styles.newsCard}><Text style={styles.category}>{story.category}</Text><Text style={styles.newsTitle}>{story.title}</Text><Text numberOfLines={2} style={styles.summary}>{story.summary}</Text><View style={styles.newsFooter}><Text style={styles.time}>{story.publishedAt}</Text><Ionicons color={colors.accent} name="arrow-forward" size={16} /></View></Pressable>)}
    </View>
  );
}

/** Full article view displayed after selecting a story from the Home feed. */
function NewsArticle({ onBack, story }: { onBack: () => void; story: NewsStory }) {
  return <View style={styles.article}><Pressable onPress={onBack} style={styles.backButton}><Ionicons color={colors.accent} name="arrow-back" size={19} /><Text style={styles.backText}>BACK TO HOME</Text></Pressable><Text style={styles.category}>{story.category}</Text><Text style={styles.articleTitle}>{story.title}</Text><Text style={styles.time}>{story.publishedAt}</Text><Text style={styles.articleBody}>{story.body}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { gap: 16 },
  text: { color: '#BBC5C3', fontSize: 14, lineHeight: 21 },
  newsHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  sectionTitle: { color: colors.text, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  sectionMeta: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
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
