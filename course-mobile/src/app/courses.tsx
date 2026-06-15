import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { parseOutlineModules, type CourseSummary } from '@courseneo/shared';
import { listCourses, PairingError } from '@/lib/pairingClient';
import { usePairingStore } from '@/store/usePairingStore';
import { theme } from '@/theme';

function lessonCount(outline: string): number {
  return parseOutlineModules(outline).reduce((n, m) => n + m.lessons.length, 0);
}

export default function CoursesScreen() {
  const router = useRouter();
  const { base, session, courses, setCourses } = usePairingStore();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!base || !session) return;
    setLoading(true);
    setErr(null);
    try {
      setCourses(await listCourses(base, session));
    } catch (e) {
      const er = e as PairingError;
      if (er.code === 'invalid_session') {
        setErr('Session expired — re-pair to continue.');
      } else {
        setErr('Could not load courses. Check the connection.');
      }
    } finally {
      setLoading(false);
    }
  }, [base, session, setCourses]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!base || !session) {
    return (
      <View style={styles.center}>
        <Text style={styles.lead}>Not paired with a desktop.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/')}>
          <Text style={styles.primaryBtnText}>Scan a pairing code</Text>
        </Pressable>
      </View>
    );
  }

  const renderItem = ({ item }: { item: CourseSummary }) => (
    <Pressable
      style={styles.card}
      onPress={() => router.push({ pathname: '/course', params: { id: item.id } })}
    >
      <View style={styles.cardMain}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.topic}</Text>
        <Text style={styles.cardMeta}>
          {item.level} · {lessonCount(item.outline)} lesson{lessonCount(item.outline) === 1 ? '' : 's'}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );

  return (
    <FlatList
      style={styles.fill}
      contentContainerStyle={styles.content}
      data={courses}
      keyExtractor={c => c.id}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.accent} />}
      ListHeaderComponent={
        <Text style={styles.heading}>Published courses</Text>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
        ) : (
          <Text style={styles.empty}>
            {err ?? 'No published courses on the desktop yet.'}
          </Text>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 18, gap: 10, flexGrow: 1 },
  center: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 28 },
  heading: {
    color: theme.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6,
    textTransform: 'uppercase', marginBottom: 6,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: theme.radius, padding: 16,
  },
  cardMain: { flex: 1, gap: 4 },
  cardTitle: { color: theme.text, fontSize: 16, fontWeight: '600' },
  cardMeta: { color: theme.textDim, fontSize: 13 },
  chevron: { color: theme.textFaint, fontSize: 24, fontWeight: '300' },
  empty: { color: theme.textDim, fontSize: 14, textAlign: 'center', marginTop: 40 },
  lead: { color: theme.textDim, fontSize: 15, textAlign: 'center' },
  primaryBtn: { backgroundColor: theme.accent, paddingVertical: 14, paddingHorizontal: 28, borderRadius: theme.radius },
  primaryBtnText: { color: theme.accentText, fontSize: 15, fontWeight: '700' },
});
