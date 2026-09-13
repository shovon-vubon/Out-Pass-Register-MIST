import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../src/context/AuthContext';
import StatusBadge from '../../src/components/StatusBadge';
import MetricCard from '../../src/components/MetricCard';
import WeeklyRequestsChart from '../../src/components/WeeklyRequestsChart';
import { COLORS } from '../../src/constants/theme';
import { DEPARTMENTS } from '../../src/constants/config';

const todayStr = () => new Date().toISOString().slice(0, 10);
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function last7DaysData(requests) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({
      label:   DAY_LABELS[d.getDay()],
      dayNum:  d.getDate(),
      count:   requests.filter(r => r.date === dateStr).length,
      isToday: i === 0,
    });
  }
  return days;
}

export default function DeptHeadDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [refresh,  setRefresh]  = useState(false);

  useEffect(() => {
    if (!profile) return;
    const dept = profile.dept;
    const isAll = dept === 'ALL' || !dept;
    const q = isAll
      ? query(collection(db, 'requests'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'requests'), where('dept', '==', dept), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false); setRefresh(false);
    }, (err) => {
      console.warn('Firestore error:', err.message);
      setLoading(false); setRefresh(false);
    });
  }, [profile]);

  const dept    = profile?.dept;
  const isAll   = dept === 'ALL' || !dept;

  const todayReqs = requests.filter(r => r.date === todayStr());
  const total   = todayReqs.length;
  const pending = todayReqs.filter(r => r.status === 'pending').length;
  const approved= todayReqs.filter(r => r.status === 'approved').length;
  const rejected= todayReqs.filter(r => r.status === 'rejected').length;
  const allTimePending = requests.filter(r => r.status === 'pending').length;

  const DEPTS = DEPARTMENTS;

  return (
    <ScrollView
      style={s.screen} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => setRefresh(true)} tintColor={COLORS.gold} />}
    >
      <Text style={s.heading}>Dept Head Dashboard</Text>
      <Text style={s.sub}>{profile?.name} · Dept: {dept || 'ALL'}</Text>

      {allTimePending > 0 && (
        <View style={s.pendingBanner}>
          <View style={s.notifDot} />
          <Text style={s.bannerText}>{allTimePending} total pending request(s) awaiting GSO-2 approval</Text>
        </View>
      )}

      {/* Metrics */}
      <View style={s.metrics}>
        <MetricCard value={total}    label="Today's Total" color={COLORS.text}  />
        <MetricCard value={pending}  label="Pending"       color={COLORS.amber} />
        <MetricCard value={approved} label="Approved"      color={COLORS.green} />
        <MetricCard value={rejected} label="Rejected"      color={COLORS.red}   />
      </View>

      <TouchableOpacity style={s.recordsBtn} onPress={() => router.push('/(depthead)/records')}>
        <Text style={s.recordsBtnText}>≡  VIEW FULL RECORDS</Text>
      </TouchableOpacity>

      <WeeklyRequestsChart data={last7DaysData(requests)} />

      {/* Per-dept breakdown (only if watching all depts) */}
      {isAll && (
        <View style={s.card}>
          <Text style={s.cardTitle}>◫ Today's Department Breakdown</Text>
          <View style={s.deptGrid}>
            {DEPTS.map(d => {
              const dr = requests.filter(r => r.dept === d && r.date === todayStr());
              const dp = dr.filter(r => r.status === 'pending').length;
              const da = dr.filter(r => r.status === 'approved').length;
              const dj = dr.filter(r => r.status === 'rejected').length;
              return (
                <View key={d} style={s.deptBox}>
                  <Text style={s.deptLabel}>{d}</Text>
                  <Text style={s.deptTotal}>{dr.length}</Text>
                  <Text style={s.deptSub}>today's requests</Text>
                  <View style={s.chips}>
                    <View style={[s.chip, { backgroundColor: COLORS.amberBg }]}><Text style={[s.chipText, { color: COLORS.amber }]}>{dp} pending</Text></View>
                    <View style={[s.chip, { backgroundColor: COLORS.greenBg }]}><Text style={[s.chipText, { color: COLORS.green }]}>{da} approved</Text></View>
                    <View style={[s.chip, { backgroundColor: COLORS.redBg   }]}><Text style={[s.chipText, { color: COLORS.red   }]}>{dj} rejected</Text></View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Today's events */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Today's Events</Text>
        {loading && <ActivityIndicator color={COLORS.gold} />}
        {!loading && requests.filter(r => r.date === todayStr()).length === 0
          ? <Text style={s.empty}>No events today</Text>
          : requests.filter(r => r.date === todayStr()).map(r => (
            <View key={r.id} style={s.todayRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.todayName}>{r.studentName} <Text style={s.todaySvc}>({r.serviceNumber})</Text></Text>
                <Text style={s.todayMeta}>{r.dept} · Out: {r.outTime} · Return by: {r.expectedReturn}</Text>
              </View>
              <StatusBadge status={r.status} />
            </View>
          ))
        }
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: COLORS.bg },
  content:       { padding: 16, paddingBottom: 40 },
  heading:       { color: COLORS.gold, fontSize: 20, fontWeight: '800', marginBottom: 2 },
  sub:           { color: COLORS.text2, fontSize: 12, marginBottom: 16 },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.amberBg, borderRadius: 8, borderWidth: 1, borderColor: COLORS.amber, padding: 12, marginBottom: 14 },
  notifDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.amber },
  bannerText:    { color: COLORS.amber, fontSize: 12, fontWeight: '600', flex: 1 },
  metrics:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  recordsBtn:    { backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginBottom: 14 },
  recordsBtnText:{ color: COLORS.gold, fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
  card:          { backgroundColor: COLORS.bg2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 14 },
  cardTitle:     { color: COLORS.gold, fontSize: 13, fontWeight: '700', marginBottom: 14, letterSpacing: 0.3 },
  deptGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  deptBox:       { width: '47%', backgroundColor: COLORS.bg3, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  deptLabel:     { color: COLORS.text2, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  deptTotal:     { color: COLORS.gold, fontSize: 26, fontWeight: '800' },
  deptSub:       { color: COLORS.text3, fontSize: 11, marginBottom: 8 },
  chips:         { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip:          { borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  chipText:      { fontSize: 9, fontWeight: '700' },
  todayRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  todayName:     { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  todaySvc:      { color: COLORS.text3, fontWeight: '400' },
  todayMeta:     { color: COLORS.text3, fontSize: 11, marginTop: 2 },
  empty:         { color: COLORS.text3, fontSize: 13, textAlign: 'center', paddingVertical: 16 },
});
