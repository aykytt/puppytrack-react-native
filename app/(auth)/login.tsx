import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../../src/lib/supabase';
import { colors, sp, radius } from '../../src/theme';
import { T } from '../../src/constants';

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </Svg>
  );
}

type Mode = 'login' | 'signup' | 'forgot';
const lang = 'en';
const t = T[lang];

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => { setError(''); setInfo(''); };

  const handleGoogle = async () => {
    reset();
    const redirectTo = 'puppytrack://auth/callback';
    const { data, error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    console.log('[Google] signInWithOAuth:', JSON.stringify({ url: data?.url?.slice(0, 80), err }));
    if (err || !data?.url) { setError(t.authError); return; }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    console.log('[Google] browserResult type:', result.type);
    if (result.type !== 'success') return;

    const url = result.url;
    const hash = url.includes('#') ? url.split('#')[1] : '';
    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    if (accessToken && refreshToken) {
      // Implicit flow — token doğrudan geldi
      const { error: sessErr } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      console.log('[Google] setSession error:', JSON.stringify(sessErr));
      if (sessErr) setError(t.authError);
    } else {
      // PKCE flow — code exchange
      const { error: exchErr } = await supabase.auth.exchangeCodeForSession(url);
      console.log('[Google] exchangeError:', JSON.stringify(exchErr));
      if (exchErr) setError(t.authError);
    }
  };

  const handleEmail = async () => {
    reset(); setLoading(true);
    const { error: err } = await (mode === 'login'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password }));
    if (err) setError(t.authError);
    else if (mode === 'signup') setInfo('Check your inbox to confirm your email.');
    setLoading(false);
  };

  const handleForgot = async () => {
    reset(); setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'puppytrack://auth/callback',
    });
    if (err) setError(t.authError);
    else setInfo(t.forgotSent);
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.emoji}>{mode === 'forgot' ? '🔑' : '🐾'}</Text>
        <Text style={s.title}>
          {mode === 'login' ? t.loginTitle : mode === 'signup' ? t.signupTitle : t.forgotTitle}
        </Text>

        {mode === 'forgot' && (
          <Text style={s.desc}>{t.forgotDesc}</Text>
        )}

        {mode !== 'forgot' && (
          <TouchableOpacity style={s.googleBtn} activeOpacity={0.8}
            onPress={handleGoogle}>
            <GoogleIcon size={18} />
            <Text style={s.googleText}>Continue with Google</Text>
          </TouchableOpacity>
        )}

        {mode !== 'forgot' && (
          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or</Text>
            <View style={s.dividerLine} />
          </View>
        )}

        <TextInput
          style={s.input}
          placeholder={t.emailLabel}
          placeholderTextColor={colors.neutral400}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        {mode !== 'forgot' && (
          <TextInput
            style={s.input}
            placeholder={t.passwordLabel}
            placeholderTextColor={colors.neutral400}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onSubmitEditing={handleEmail}
          />
        )}

        {mode === 'login' && (
          <TouchableOpacity onPress={() => { setMode('forgot'); reset(); }} style={s.forgotLink}>
            <Text style={s.forgotText}>{t.forgotPassword}</Text>
          </TouchableOpacity>
        )}

        {!!error && <Text style={s.errorText}>{error}</Text>}
        {!!info  && <Text style={s.infoText}>{info}</Text>}

        <TouchableOpacity
          style={[s.primaryBtn, (loading || !email || (mode !== 'forgot' && !password)) && s.disabled]}
          onPress={mode === 'forgot' ? handleForgot : handleEmail}
          disabled={loading || !email || (mode !== 'forgot' && !password)}
          activeOpacity={0.85}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.primaryBtnText}>
                {mode === 'login' ? t.loginBtn : mode === 'signup' ? t.signupBtn : t.forgotBtn}
              </Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => {
          setMode(mode === 'forgot' ? 'login' : mode === 'login' ? 'signup' : 'login');
          reset();
        }}>
          <Text style={s.switchText}>
            {mode === 'login' ? t.switchToSignup : mode === 'signup' ? t.switchToLogin : t.backToLogin}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral100 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: sp[6] },
  emoji: { fontSize: 52, marginBottom: sp[2] },
  title: { fontFamily: 'Fraunces_900Black', fontSize: 28, color: colors.neutral900, marginBottom: sp[4], textAlign: 'center' },
  desc: { fontSize: 13, color: colors.neutral600, textAlign: 'center', marginBottom: sp[4], lineHeight: 20 },
  googleBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: sp[3], borderRadius: radius.lg, borderWidth: 1.5,
    borderColor: colors.neutral200, backgroundColor: '#fff', marginBottom: sp[3],
  },
  googleText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: colors.neutral900 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: sp[3] },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.neutral200 },
  dividerText: { marginHorizontal: sp[2], fontSize: 12, color: colors.neutral500 },
  input: {
    width: '100%', padding: sp[3], borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.neutral200,
    backgroundColor: '#fff', fontSize: 15, color: colors.neutral900,
    fontFamily: 'DMSans_400Regular', marginBottom: sp[2],
  },
  forgotLink: { alignSelf: 'flex-end', marginBottom: sp[2] },
  forgotText: { fontSize: 12, color: colors.neutral500, fontFamily: 'DMSans_600SemiBold' },
  errorText: { fontSize: 13, color: colors.danger, textAlign: 'center', marginBottom: sp[2] },
  infoText: { fontSize: 13, color: colors.success, textAlign: 'center', marginBottom: sp[2] },
  primaryBtn: {
    width: '100%', backgroundColor: colors.accent500, borderRadius: radius.md,
    padding: sp[3], alignItems: 'center', marginBottom: sp[3],
  },
  primaryBtnText: { color: '#fff', fontFamily: 'DMSans_700Bold', fontSize: 14 },
  disabled: { opacity: 0.4 },
  switchText: { fontSize: 13, color: colors.accent600, fontFamily: 'DMSans_600SemiBold' },
});
