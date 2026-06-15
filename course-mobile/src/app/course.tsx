import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { parseOutlineModules } from '@courseneo/shared';
import { presentCourse, PairingError } from '@/lib/pairingClient';
import { usePairingStore } from '@/store/usePairingStore';
import { theme } from '@/theme';

export default function CourseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { base, session, courses } = usePairingStore();
  const course = courses.find(c => c.id === id);

  const [presenting, setPresenting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!course) {
    return (
      <View style={styles.center}>
        <Text style={styles.lead}>Course not found.</Text>
        <Pressable style={styles.linkWrap} onPress={() => router.replace('/courses')}>
          <Text style={styles.link}>Back to courses</Text>
        </Pressable>
      </View>
    );
  }

  const modules = parseOutlineModules(course.outline);

  async function present() {
    if (!base || !session || !course) return;
    setPresenting(true);
    setErr(null);
    setDone(false);
    try {
      await presentCourse(base, session, course.id);
      setDone(true);
    } catch (e) {
      const er = e as PairingError;
      setErr(er.code === 'invalid_session' ? 'Session expired — re-pair to continue.' : 'Could not start the presentation.');
    } finally {
      setPresenting(false);
    }
  }

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{course.topic}</Text>
      <Text style={styles.meta}>{course.level}</Text>

      <Pressable style={[styles.presentBtn, presenting && styles.btnDisabled]} disabled={presenting} onPress={present}>
        {presenting ? (
          <ActivityIndicator color={theme.accentText} />
        ) : (
          <Text style={styles.presentBtnText}>▶  Present on desktop</Text>
        )}
      </Pressable>
      {done && <Text style={styles.success}>Presenting on the desktop now.</Text>}
      {err && <Text style={styles.error}>{err}</Text>}

      {modules.map((m, mi) => (
        <View key={`${m.module}-${mi}`} style={styles.module}>
          <Text style={styles.moduleTitle}>{m.module}</Text>
          {m.lessons.map((l, li) => (
            <View key={`${l}-${li}`} style={styles.lessonRow}>
              <Text style={styles.lessonNum}>{li + 1}</Text>
              <Text style={styles.lessonText}>{l}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 22, gap: 12 },
  center: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 28 },
  title: { color: theme.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  meta: { color: theme.textDim, fontSize: 14, marginTop: -4 },
  presentBtn: {
    backgroundColor: theme.accent, paddingVertical: 16, borderRadius: theme.radius,
    alignItems: 'center', marginTop: 8,
  },
  presentBtnText: { color: theme.accentText, fontSize: 16, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
  success: { color: theme.success, fontSize: 13 },
  error: { color: theme.error, fontSize: 13 },
  module: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: theme.radius, padding: 16, gap: 10, marginTop: 6,
  },
  moduleTitle: { color: theme.text, fontSize: 16, fontWeight: '700' },
  lessonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  lessonNum: {
    color: theme.accent, fontSize: 13, fontWeight: '700', width: 20, textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  lessonText: { color: theme.textDim, fontSize: 14, flex: 1, lineHeight: 20 },
  lead: { color: theme.textDim, fontSize: 15, textAlign: 'center' },
  linkWrap: { padding: 8 },
  link: { color: theme.accent, fontSize: 14, fontWeight: '600' },
});
