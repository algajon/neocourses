import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { PROTOCOL_VERSION, type PairingPayload } from '@courseneo/shared';
import { ping, pair, resolveBase, PairingError } from '@/lib/pairingClient';
import { usePairingStore } from '@/store/usePairingStore';
import { theme } from '@/theme';

export default function PairScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const setConnection = usePairingStore((s) => s.setConnection);
  const setSession = usePairingStore((s) => s.setSession);

  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payload, setPayload] = useState<PairingPayload | null>(null);
  const [pinNeeded, setPinNeeded] = useState(false);
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const deviceName = Device.deviceName || `${Device.osName ?? 'Mobile'} device`;

  function resetScan() {
    setScanned(false);
    setPayload(null);
    setPinNeeded(false);
    setPin('');
  }

  async function attemptPair(p: PairingPayload, pinValue?: string) {
    setBusy(true);
    setMsg(null);
    const base = resolveBase(p);
    try {
      await ping(base);
      const res = await pair(base, { token: p.token, pin: pinValue, device: deviceName });
      setConnection({ base, name: p.name });
      setSession({ session: res.session, expiresAt: res.expiresAt, host: res.host });
      setBusy(false);
      router.replace('/upload');
    } catch (e) {
      setBusy(false);
      const err = e as PairingError;
      if (err.code === 'invalid_pin') {
        setPinNeeded(true);
        setMsg(pinValue ? 'Wrong PIN — try again.' : 'This desktop requires a PIN. Enter it below.');
      } else if (err.code === 'invalid_token') {
        setMsg('That code expired. Restart pairing on the desktop, then scan again.');
        resetScan();
      } else if (err.code === 'already_paired') {
        setMsg('Another device is already paired. Disconnect it on the desktop first.');
        resetScan();
      } else {
        setMsg(`Could not reach the desktop at ${base}. Check the connection and try again.`);
        resetScan();
      }
    }
  }

  function onScan(data: string) {
    if (scanned) return;
    setScanned(true);
    let parsed: PairingPayload;
    try {
      parsed = JSON.parse(data) as PairingPayload;
    } catch {
      setMsg('That is not a courseneo pairing code.');
      setScanned(false);
      return;
    }
    if (!parsed || parsed.v !== PROTOCOL_VERSION) {
      setMsg('Update your courseneo app to pair with this desktop.');
      setScanned(false);
      return;
    }
    setPayload(parsed);
    void attemptPair(parsed);
  }

  // ── Permission gates ──
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Wordmark />
        <Text style={styles.lead}>
          courseneo needs the camera to scan the pairing code shown on your desktop.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Allow camera</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── PIN entry (on-demand) ──
  if (pinNeeded && payload) {
    return (
      <SafeAreaView style={styles.center}>
        <Wordmark />
        <Text style={styles.lead}>Enter the PIN shown on the desktop</Text>
        <TextInput
          style={styles.pinInput}
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          maxLength={4}
          placeholder="0000"
          placeholderTextColor={theme.textFaint}
          autoFocus
        />
        {msg && <Text style={styles.error}>{msg}</Text>}
        <Pressable
          style={[styles.primaryBtn, (busy || pin.length < 4) && styles.btnDisabled]}
          disabled={busy || pin.length < 4}
          onPress={() => attemptPair(payload, pin)}
        >
          {busy ? (
            <ActivityIndicator color={theme.accentText} />
          ) : (
            <Text style={styles.primaryBtnText}>Pair</Text>
          )}
        </Pressable>
        <Pressable onPress={resetScan}>
          <Text style={styles.linkBtn}>Scan a different code</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── Scanner ──
  return (
    <View style={styles.fill}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : (r) => onScan(r.data)}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <Wordmark light />
        <View style={styles.reticle} />
        <View style={styles.hintCard}>
          {busy ? (
            <View style={styles.row}>
              <ActivityIndicator color={theme.accent} />
              <Text style={styles.hintText}>Connecting…</Text>
            </View>
          ) : (
            <Text style={styles.hintText}>
              {msg ?? 'Point your camera at the pairing code on your desktop.'}
            </Text>
          )}
          {!busy && scanned && (
            <Pressable onPress={resetScan}>
              <Text style={styles.linkBtn}>Tap to scan again</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function Wordmark({ light }: { light?: boolean }) {
  return (
    <Text style={[styles.wordmark, light && styles.wordmarkLight]}>
      course<Text style={styles.wordmarkAccent}>neo</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  center: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 18,
  },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'space-between', padding: 28 },
  wordmark: { fontSize: 26, fontWeight: '800', color: theme.text, letterSpacing: -0.5 },
  wordmarkLight: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 },
  wordmarkAccent: { color: theme.accent },
  lead: { color: theme.textDim, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  reticle: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: theme.accent,
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  hintCard: {
    width: '100%',
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: 18,
    gap: 10,
    alignItems: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hintText: { color: theme.text, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  primaryBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: theme.radius,
    alignItems: 'center',
    minWidth: 160,
  },
  primaryBtnText: { color: theme.accentText, fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  linkBtn: { color: theme.accent, fontSize: 14, fontWeight: '600', padding: 6 },
  error: { color: theme.error, fontSize: 13, textAlign: 'center' },
  pinInput: {
    backgroundColor: theme.surface2,
    color: theme.text,
    borderRadius: theme.radius,
    paddingVertical: 14,
    paddingHorizontal: 20,
    fontSize: 28,
    letterSpacing: 12,
    textAlign: 'center',
    width: 200,
    borderWidth: 1,
    borderColor: theme.border,
  },
});
