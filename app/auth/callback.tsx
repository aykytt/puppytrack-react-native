import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme';

WebBrowser.maybeCompleteAuthSession();

export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();

  useEffect(() => {
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          router.replace('/(auth)/login');
          return;
        }
        // Recovery session → şifre güncelleme ekranına yönlendir
        if (data.session?.user.recovery_sent_at) {
          router.replace('/auth/reset-password');
        }
        // OAuth veya normal session → RootGuard yönlendirir
      });
    } else {
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) router.replace('/(auth)/login');
      });
    }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.neutral100, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={colors.accent500} />
    </View>
  );
}
