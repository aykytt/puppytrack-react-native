import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { colors, sp, radius } from '../../src/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    router.replace('/(tabs)/');
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.inner}>
        <Text style={s.emoji}>🔑</Text>
        <Text style={s.title}>Set new password</Text>
        <TextInput
          style={s.input}
          placeholder="New password"
          placeholderTextColor={colors.neutral400}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoFocus
        />
        <TextInput
          style={s.input}
          placeholder="Confirm password"
          placeholderTextColor={colors.neutral400}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          onSubmitEditing={handleReset}
        />
        {!!error && <Text style={s.error}>{error}</Text>}
        <TouchableOpacity
          style={[s.btn, (!password || !confirm || loading) && s.disabled]}
          onPress={handleReset}
          disabled={!password || !confirm || loading}
          activeOpacity={0.85}>
          <Text style={s.btnText}>{loading ? 'Saving…' : 'Save password'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.neutral100 },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: sp[6] },
  emoji: { fontSize: 48, marginBottom: sp[2] },
  title: { fontFamily: 'Fraunces_900Black', fontSize: 26, color: colors.neutral900, marginBottom: sp[5], textAlign: 'center' },
  input: {
    width: '100%', padding: sp[3], borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.neutral200,
    backgroundColor: '#fff', fontSize: 15, color: colors.neutral900,
    fontFamily: 'DMSans_400Regular', marginBottom: sp[2],
  },
  error: { fontSize: 13, color: colors.danger, marginBottom: sp[2], textAlign: 'center' },
  btn:   { width: '100%', backgroundColor: colors.accent500, borderRadius: radius.md, padding: sp[3], alignItems: 'center', marginTop: sp[2] },
  btnText: { color: '#fff', fontFamily: 'DMSans_700Bold', fontSize: 14 },
  disabled: { opacity: 0.4 },
});
