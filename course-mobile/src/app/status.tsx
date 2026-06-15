import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePairingStore } from '@/store/usePairingStore';
import { theme } from '@/theme';

const STATUS_LABEL: Record<string, string> = {
  received: 'Received',
  generating: 'Generating',
  draft_ready: 'Draft ready',
  failed: 'Failed',
};

export default function StatusScreen() {
  const router = useRouter();
  const { base, desktopName, session, expiresAt, uploads, clear } = usePairingStore();

  const paired = Boolean(session && base);

  function disconnect() {
    clear();
    router.replace('/');
  }

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: paired ? theme.success : theme.textFaint }]} />
          <Text style={styles.status}>{paired ? 'Connected' : 'Not paired'}</Text>
        </View>
        {paired && (
          <View style={styles.meta}>
            <Meta k="Desktop" v={desktopName ?? '—'} />
            <Meta k="Address" v={base ?? '—'} />
            {expiresAt && <Meta k="Session ends" v={new Date(expiresAt).toLocaleTimeString()} />}
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Recent uploads</Text>
      {uploads.length === 0 ? (
        <Text style={styles.empty}>Nothing sent yet this session.</Text>
      ) : (
        uploads.map((u) => (
          <View key={u.courseId} style={styles.uploadRow}>
            <Text style={styles.uploadName} numberOfLines={1}>
              {u.title}
            </Text>
            <Text style={styles.uploadStatus}>{STATUS_LABEL[u.status] ?? u.status}</Text>
          </View>
        ))
      )}

      {paired ? (
        <>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/upload')}>
            <Text style={styles.primaryBtnText}>Upload another</Text>
          </Pressable>
          <Pressable onPress={disconnect}>
            <Text style={styles.dangerLink}>Disconnect</Text>
          </Pressable>
        </>
      ) : (
        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/')}>
          <Text style={styles.primaryBtnText}>Scan a pairing code</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaKey}>{k}</Text>
      <Text style={styles.metaVal}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 22, gap: 14 },
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius,
    padding: 18,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  status: { color: theme.text, fontSize: 16, fontWeight: '700' },
  meta: { gap: 6 },
  metaRow: { flexDirection: 'row', gap: 12 },
  metaKey: { color: theme.textFaint, fontSize: 13, width: 110 },
  metaVal: { color: theme.text, fontSize: 13, flex: 1 },
  sectionTitle: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  empty: { color: theme.textDim, fontSize: 14 },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.surface2,
    borderRadius: theme.radius,
    padding: 14,
    gap: 12,
  },
  uploadName: { color: theme.text, fontSize: 14, flex: 1 },
  uploadStatus: { color: theme.accent, fontSize: 12, fontWeight: '700' },
  primaryBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 15,
    borderRadius: theme.radius,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryBtnText: { color: theme.accentText, fontSize: 15, fontWeight: '700' },
  dangerLink: { color: theme.error, fontSize: 14, fontWeight: '600', textAlign: 'center', padding: 10 },
});
