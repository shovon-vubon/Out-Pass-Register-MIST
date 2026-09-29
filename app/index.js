import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { COLORS } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { Redirect } from 'expo-router';

export default function LoginScreen() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail]   = useState('');
  const [pw, setPw]         = useState('');
  const [error, setError]   = useState('');
  const [busy, setBusy]     = useState(false);

  if (loading) return <View style={s.center}><ActivityIndicator color={COLORS.gold} size="large" /></View>;
  if (profile && profile.regStatus === 'approved') {
    const dest = { student: '/(student)/', gso2: '/(gso2)/', depthead: '/(depthead)/', admin: '/(admin)/' }[profile.role];
    return <Redirect href={dest || '/(student)/'} />;
  }

  async function handleLogin() {
    const identifier = email.trim();
    if (!identifier || !pw) { setError('Enter service number or email and password.'); return; }
    setBusy(true); setError('');
    try {
      let loginEmail = identifier;

      // Detect service number: starts with BA/BD/BN (with or without dash)
      const svcMatch = identifier.toUpperCase().match(/^(BA|BD|BN)-?(.+)$/);
      if (svcMatch) {
        const normalised = `${svcMatch[1]}-${svcMatch[2]}`;
        const snap = await getDoc(doc(db, 'serviceNumbers', normalised));
        if (!snap.exists()) { setError('Service number not found.'); setBusy(false); return; }
        loginEmail = snap.data().email;
      }

      const credential = await signInWithEmailAndPassword(auth, loginEmail, pw);
      const snap = await getDoc(doc(db, 'users', credential.user.uid));
      if (!snap.exists()) { setError('Account not found.'); setBusy(false); return; }
      const data = snap.data();
      if (data.regStatus === 'pending') {
        setError('Your registration is pending admin approval.'); setBusy(false); return;
      }
      if (data.regStatus === 'rejected') {
        setError('Your registration was rejected. Contact admin.'); setBusy(false); return;
      }
      if (data.regStatus !== 'approved') {
        setError(`Account setup incomplete. Contact admin. ${data.regStatus} + ${data.email} + ${data.role}` ); setBusy(false); return;
      }
    } catch (e) {
      setError(`Invalid credentials. Try again. [${e.code}] ${e.message}`);
    }
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          {/* Emblem */}
          <View style={s.emblem}>
            <Image source={require('../assets/mist-logo.png')} style={s.logo} />
            <Text style={s.title}>Out Pass Register</Text>
            <Text style={s.subtitle}>IN / OUT DIGITAL REGISTER · MIST BANGLADESH</Text>
          </View>

          {/* Tabs */}
          <View style={s.tabs}>
            <View style={[s.tab, s.tabActive]}><Text style={s.tabTextActive}>SIGN IN</Text></View>
            <TouchableOpacity style={s.tab} onPress={() => router.push('/register')}>
              <Text style={s.tabText}>REGISTER</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <Text style={s.label}>Service Number or Email</Text>
          <TextInput
            style={s.input} placeholderTextColor={COLORS.text3}
            placeholder="e.g. BA-01234 or name@gmail.com"
            value={email} onChangeText={setEmail}
            autoCapitalize="none"
          />
          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input} placeholderTextColor={COLORS.text3}
            placeholder="Password" secureTextEntry
            value={pw} onChangeText={setPw}
            onSubmitEditing={handleLogin}
          />

          {!!error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={busy}>
            {busy ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>SIGN IN</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.forgotLink} onPress={() => router.push('/forgot-password')}>
            <Text style={s.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: COLORS.bg },
  scroll:       { flexGrow: 1, justifyContent: 'center', padding: 20 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  card:         { backgroundColor: COLORS.bg2, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 24, borderTopWidth: 3, borderTopColor: COLORS.gold },
  emblem:       { alignItems: 'center', marginBottom: 24 },
  logo:         { width: 90, height: 90, marginBottom: 10, resizeMode: 'contain' },
  title:        { color: COLORS.gold, fontSize: 20, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  subtitle:     { color: COLORS.text3, fontSize: 10, marginTop: 4, letterSpacing: 0.5, textAlign: 'center' },
  tabs:         { flexDirection: 'row', borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: 20 },
  tab:          { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive:    { backgroundColor: COLORS.gold },
  tabText:      { color: COLORS.text2, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  tabTextActive:{ color: '#000', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  label:        { color: COLORS.text2, fontSize: 12, marginBottom: 6, letterSpacing: 0.3 },
  input:        { backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, color: COLORS.text, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, marginBottom: 12 },
  error:        { color: COLORS.red, fontSize: 12, marginBottom: 10 },
  btn:          { backgroundColor: COLORS.gold, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnText:      { color: '#000', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  forgotLink:   { marginTop: 14, alignItems: 'center' },
  forgotText:   { color: COLORS.text3, fontSize: 13 },
});
