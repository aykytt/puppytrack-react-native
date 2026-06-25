@AGENTS.md

## Emülatörde Çalıştırma

**Tek tıkla açmak için:** `açmak için/puppytrack-baslat.command` dosyasına Finder'dan çift tıkla.

**Script ne yapar:**
1. Eski emülatör ve Metro (port 8081) süreçlerini öldürür
2. `Medium_Phone` AVD'yi `-no-snapshot-load` ile temiz başlatır
3. Boot tamamlanana kadar bekler (`sys.boot_completed=1`)
4. `adb reverse tcp:8081 tcp:8081` ile tüneli açar
5. `npx expo start --android` ile Expo'yu başlatır

**Sorun giderme:**
- `offline` hatası → `pkill -f qemu` + script'i yeniden çalıştır
- "Port 8081 in use" → `kill $(lsof -ti:8081)` + tekrar dene
- Sürekli beyaz/siyah ekran → script'e `-wipe-data` flag'i ekle (veri silinir)
- `gesture-handler` crash → `npx expo install react-native-gesture-handler` (2.31.2 olmalı)

---

# ⏸ KALDIK YER — Sonraki Oturum Buradan Devam

## Tamamlanan Katmanlar

### Layer 0 — Altyapı ✅
- Supabase: `dogs`, `training_logs`, `feeding_logs` tabloları
- AuthContext, useFocusEffect ile tab refresh, LangContext (global TR/EN)
- StatusBar dark, SplashScreen, expo-router

### Layer 1 — Ana Ekranlar ✅
- **index.tsx** — useFocusEffect, SVG ikonlar (PeeSVG/PoopSVG/BothSVG), useCountUp animasyonu, iki butonlu [TR][EN] toggle, prediction banner, feeding log butanları
- **analysis.tsx** — useFocusEffect, useLang() bağlı, animated BarChart + Donut + StackedBar + HBar, 4 tab
- **history.tsx** — useFocusEffect, useLang() bağlı, silme özelliği
- **profile.tsx** — useLang() bağlı, DateTimePicker ile doğum tarihi, köpek adı düzenlenebilir (TextInput), seed data, delete dog düzeltmesi

### Layer 2 — Bileşenler ✅
- `src/components/charts/BarChart.tsx` — Animated.spring ile canlandırılmış
- `src/components/charts/Donut.tsx` — AnimatedCircle ile canlandırılmış
- `src/components/icons/SubIcons.tsx` — PeeSVG, PoopSVG, BothSVG
- `src/hooks/useCountUp.ts` — Animated.Value listener ile sayı animasyonu
- `src/lib/LangContext.tsx` — global lang state, tüm tablara yayılıyor

## Bu Oturumda Tamamlananlar (2026-06-21)

### RhythmBar Kartı (index.tsx)
- Kart en alta taşındı (feeding butonlarının altına)
- `RhythmBar` component: 10'luk döngü, progress bar, icon + count
- İki durum: < 10 kayıt → teşvik metni, ≥ 10 → offset sonuçları + son hesaplanma tarihi
- `computeWaterPairCount` / `computeFoodPairCount` client-side hesaplama (DB trigger'a bağlı değil, anlık güncelleniyor)
- `formatShortDate` → `toLocaleDateString` kullanıyor (NaN bug fix için)

### Dil Sistemi
- TR/EN toggle home'dan kaldırıldı → Profile → App Settings'e taşındı
- `LangContext`: `getDeviceLang()` ile cihaz dilini otomatik algılıyor
- Tüm RhythmBar metinleri `t.*` key'lerine bağlandı (TR/EN)
- `Translations = Record<string, string>` tipi — **UYARI: array veya function değer kabul etmez**, `monthNames: string[]` bu yüzden crash yaptı

### Bug Fix'ler
- `formatShortDate(date, t.monthNames)` → `Translations` tipi array kabul etmediği için `undefined` dönüyordu → `toLocaleDateString(lang)` ile değiştirildi
- `toLocaleTimeString('en')` → Android'de "12:26 PM" formatı üretiyor, `Number('26 PM') = NaN` → prediction crash → `String(d.getHours()).padStart(2,'0')` ile fix edildi
- `computePrediction`: `isNaN(lh) || isNaN(lm)` guard eklendi
- `shouldShowAlert` deprecated → `notifications.ts`'den kaldırıldı
- `addFeedingLog` ve seed data: UUID için `generateUUID()` kullanılıyor
- `getFeedingOffset(activeDog.id)` → `getFeedingOffset(activeDog)` düzeltildi

### UX Düzeltmeler
- `SafeAreaView edges={['top','left','right']}` — tüm tab ekranlarında (bottom inset sorunu)
- `bounces={false} overScrollMode="never"` — tüm ScrollView'larda
- `showsVerticalScrollIndicator={false}` — tüm ScrollView'larda
- `tabBarPressColor: 'transparent'` — Android nav bar ripple kaldırıldı
- Profile > Name TextInput: `textAlign: 'center'`, `autoCapitalize: 'words'`
- `dateFieldPlaceholder`: `neutral400` → `neutral500` (WCAG)
- RhythmBar count / label / timestamp: `neutral400` → `neutral600` (WCAG AA)

### Consent & Bildirim Sistemi
- `src/lib/consentStorage.ts`: `shouldShowConsent`, `acceptConsent`, `dismissConsent`, `getConsentGiven`, `clearConsent`
- `ConsentSheet`: 10. kayıt sonrası, max 3 kez, 10 gün arayla
- `NotifPromptSheet`: 3. kayıt sonrası, tek seferlik, `shouldPromptForPermission` + `markPermissionPrompted`
- `src/lib/notifications.ts`: `notifCopy` TR/EN objesi, `getDeviceLang()` ile seçim yapıyor
- Profile > dataConsent toggle: AsyncStorage'dan okuyor, `acceptConsent`/`clearConsent` yazıyor

### Supabase Durumu
- `water_pair_count`, `food_pair_count` kolonları dogs tablosuna eklendi ✅
- `feeding_offset_updater` trigger mevcut ✅
- Schema tamamlandı, Play Store'a atılabilir

## Sonraki Görevler (Ertelenen)

### 1. Bildirim Saat Seçici
Morning reminder 07:00, night reminder 22:00 sabit kodlu. Kullanıcı değiştiremez.
Profile > Bildirimler sayfasına TimePicker eklenecek.

### 2. iOS / App Store Hazırlığı
- `app.json`'a eklenecek:
  ```json
  "ios": {
    "infoPlist": {
      "NSUserNotificationUsageDescription": "We'll remind you when it's time for your dog's bathroom break."
    }
  }
  ```
- Privacy Policy URL (`PRIVACY_URL`) canlıya alınmalı (şu an placeholder)
- Apple Developer hesabı ($99/yıl) gerekli
- `eas build --platform ios` ile build alınır (Mac gerekmez)
- Google login aktifleştirilirse Sign in with Apple zorunlu olur

### 3. Google Login (Android) — Hâlâ Kırık
CLAUDE.md'de önceden not alınmıştı. Dokunulmadı.

### 4. Ana Sayfa Buton UI Kararı
3 opsiyon HTML prototipi hazırlandı: `~/Desktop/puppytrack_proto_a.html`
- **A**: Solid renkli butonlar (dominant, net ayrım)
- **B**: Sabit alt aksiyon şeridi (her zaman görünür)
- **C**: Outlined buton grubu tek kartta (dengeli)
Kullanıcı "A çok baskın" dedi, karar verilmedi. Sonraki oturumda seçilecek ve uygulanacak.

### 5. WCAG — Kalan Sorunlar
Düzeltilenler dışında kalan:
- `accent500` (#E8520A) metin olarak kullanıldığında white üstünde 3.67:1 → AA altında (normal metin için)
- `white on accent500` buton metni 3.67:1 → bold/büyük metin muafiyetiyle sınırda

### 6. Test Edilmedi
- ConsentSheet görsel + akış testi
- NotifPromptSheet görsel + akış testi
- Gerçek Android cihazda overscroll davranışı
- iOS'ta uygulama genel davranışı

---

# How to Run the App

**Primary tool: Android Studio** — emulator, debugging, logcat hepsi buradan.

**Terminal sadece iki durumda gereklidir:**

1. **Yeni native paket eklendiğinde** (npm install sonrası):
   ```
   cd ~/Desktop/puppytrack-rn && npx expo run:android
   ```
   Bu APK'yı build edip emülatöre kurar ve Metro'yu başlatır.

2. **Metro kapandıysa** (terminal kapatıldıysa):
   ```
   cd ~/Desktop/puppytrack-rn && npx expo run:android
   ```

**Günlük kullanımda:** Android Studio'yu aç, emülatörü başlat, app'i çalıştır. Terminal açık kaldığı sürece başka komut gerekmez. JS değişiklikleri emülatörde R, R ile yüklenir.

**Yasak komutlar:** `expo start`, `expo start --clear` — bunlar native modülleri bozar, kullanma.

---

# Working Principles

## 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
