import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { MAX_UPLOAD_BYTES } from '@courseneo/shared';
import { uploadCourse, PairingError, type PickedFile } from '@/lib/pairingClient';
import { usePairingStore } from '@/store/usePairingStore';
import { theme } from '@/theme';

type Picked = PickedFile & { size?: number };

export default function UploadScreen() {
  const router = useRouter();
  const { base, session, desktopName, addUpload } = usePairingStore();

  const [file, setFile] = useState<Picked | null>(null);
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!session || !base) {
    return (
      <View style={styles.center}>
        <Text style={styles.lead}>You are not paired with a desktop yet.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/')}>
          <Text style={styles.primaryBtnText}>Scan a pairing code</Text>
        </Pressable>
      </View>
    );
  }

  async function pickFile() {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: '*/*' });
    if (r.canceled) return;
    const a = r.assets[0];
    if (a.size && a.size > MAX_UPLOAD_BYTES) {
      setErr('That file is larger than 100 MB.');
      return;
    }
    setErr(null);
    setFile({ uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size });
    if (!title.trim()) {
      setTitle(a.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    }
  }

  async function send() {
    if (!session || !base) return;
    if (!file && !brief.trim()) {
      setErr('Add a file or a brief — at least one.');
      return;
    }
    if (!title.trim()) {
      setErr('Give the course a title.');
      return;
    }
    setSending(true);
    setErr(null);
    setDone(null);
    try {
      const res = await uploadCourse(
        base,
        session,
        { title: title.trim(), brief: brief.trim() || undefined },
        file ?? undefined,
      );
      addUpload({ courseId: res.courseId, title: title.trim(), status: res.status });
      setDone('Sent — your desktop is generating the course now.');
      setFile(null);
      setBrief('');
      setTitle('');
    } catch (e) {
      const er = e as PairingError;
      if (er.code === 'invalid_session') {
        setErr('Your session expired. Re-pair to keep uploading.');
      } else if (er.code === 'file_too_large') {
        setErr('That file is larger than 100 MB.');
      } else if (er.code === 'unsupported_type') {
        setErr('That file type is not supported.');
      } else if (er.code === 'missing_payload') {
        setErr('Add a file or a brief.');
      } else {
        setErr('Upload failed. Check the connection and try again.');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content}>
      <Text style={styles.connected}>
        Connected to <Text style={styles.connectedName}>{desktopName ?? base}</Text>
      </Text>

      <Text style={styles.label}>Source file</Text>
      <Pressable style={styles.fileBox} onPress={pickFile}>
        <Text style={styles.fileBoxText}>
          {file ? file.name : 'Choose a PDF, audio, video, or document'}
        </Text>
        <Text style={styles.fileBoxAction}>{file ? 'Change' : 'Browse'}</Text>
      </Pressable>

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Course title"
        placeholderTextColor={theme.textFaint}
      />

      <Text style={styles.label}>Brief (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={brief}
        onChangeText={setBrief}
        placeholder="What should this course cover? Audience, goals, key topics…"
        placeholderTextColor={theme.textFaint}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      {err && <Text style={styles.error}>{err}</Text>}
      {done && <Text style={styles.success}>{done}</Text>}

      <Pressable
        style={[styles.primaryBtn, sending && styles.btnDisabled]}
        disabled={sending}
        onPress={send}
      >
        {sending ? (
          <ActivityIndicator color={theme.accentText} />
        ) : (
          <Text style={styles.primaryBtnText}>Send to desktop</Text>
        )}
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={() => router.push('/courses')}>
        <Text style={styles.secondaryBtnText}>Browse &amp; present courses</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/status')}>
        <Text style={styles.linkBtn}>Connection &amp; recent uploads</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 22, gap: 12 },
  center: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    padding: 28,
  },
  connected: { color: theme.textDim, fontSize: 13, marginBottom: 4 },
  connectedName: { color: theme.success, fontWeight: '700' },
  lead: { color: theme.textDim, fontSize: 15, textAlign: 'center' },
  label: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  fileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius,
    padding: 16,
    gap: 12,
  },
  fileBoxText: { color: theme.text, fontSize: 14, flex: 1 },
  fileBoxAction: { color: theme.accent, fontSize: 13, fontWeight: '700' },
  input: {
    backgroundColor: theme.surface,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius,
    padding: 14,
    fontSize: 15,
  },
  multiline: { minHeight: 110 },
  primaryBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 15,
    borderRadius: theme.radius,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: theme.accentText, fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  secondaryBtn: {
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
    paddingVertical: 14, borderRadius: theme.radius, alignItems: 'center', marginTop: 4,
  },
  secondaryBtnText: { color: theme.text, fontSize: 15, fontWeight: '600' },
  linkBtn: { color: theme.accent, fontSize: 14, fontWeight: '600', textAlign: 'center', padding: 10 },
  error: { color: theme.error, fontSize: 13 },
  success: { color: theme.success, fontSize: 13 },
});
