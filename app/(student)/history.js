import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../src/context/AuthContext';
import StatusBadge from '../../src/components/StatusBadge';
import { COLORS } from '../../src/constants/theme';
import { format } from 'date-fns';

const fmtDate = d => { try { return format(new Date(d), 'dd MMM yyyy'); } catch { return d || '—'; } };

export default function StudentHistory() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [refresh,  setRefresh]  = useState(false);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'requests'),
      where('studentId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false); setRefresh(false);
    }, (err) => {
      console.warn('Firestore error:', err.message);
      setLoading(false); setRefresh(false);
    });
    return unsub;
  }, [profile]);

  // Separate timeout and regular requests
  const timeoutRequests = useMemo(() => {
    return requests.filter(r => r.status === 'timeout');
  }, [requests]);

  const regularRequests = useMemo(() => {
    return requests.filter(r => r.status !== 'timeout');
  }, [requests]);

  return (
    <ScrollView
      style={s.screen} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => setRefresh(true)} tintColor={COLORS.gold} />}
    >
      <Text style={s.heading}>My Request History</Text>
      <Text style={s.sub}>{requests.length} total requests</Text>

      {loading && <ActivityIndicator color={COLORS.gold} style={{ marginTop: 30 }} />}

      {!loading && requests.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>⊘</Text>
          <Text style={s.emptyText}>No requests yet</Text>
        </View>
      )}

      {/* ===================================================
          REGULAR REQUESTS SECTION
          =================================================== */}
      {regularRequests.length > 0 && (
        <View>
          <Text style={[s.heading, { marginTop: 16, marginBottom: 10, fontSize: 15, color: COLORS.text1 }]}>
            📋 My Requests
          </Text>
          {regularRequests.map((r) => (
            <View key={r.id} style={s.card}>
              <View style={s.cardHeader}>
                <View>
                  <Text style={s.cardDate}>{fmtDate(r.date)}</Text>
                </View>
                <StatusBadge status={r.status} />
              </View>
              <Text style={s.cause} numberOfLines={2}>{r.cause}</Text>
              <View style={s.meta}>
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>Departure</Text>
                  <Text style={s.metaValue}>{r.outTime}</Text>
                </View>
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>Return By</Text>
                  <Text style={s.metaValue}>{r.expectedReturn}</Text>
                </View>
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>Actual Return</Text>
                  <Text style={s.metaValue}>{r.actualReturn || '—'}</Text>
                </View>
              </View>
              {r.remarks ? (
                <View style={s.remarksBox}>
                  <Text style={s.remarksLabel}>Remarks: </Text>
                  <Text style={s.remarksText}>{r.remarks}</Text>
                </View>
              ) : null}
              {r.arrivalSent && (
                <View style={s.arrivalTag}>
                  <Text style={s.arrivalText}>✓ Arrival sent at {r.arrivalTime}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* ===================================================
          TIMEOUT / TIME OVER REQUESTS SECTION
          =================================================== */}
      {timeoutRequests.length > 0 && (
        <View style={{ marginTop: 20, borderTopWidth: 2, borderTopColor: '#ff6b6b', paddingTop: 16 }}>
          <Text style={[s.heading, { marginBottom: 8, fontSize: 15, color: '#ff6b6b' }]}>
            ⏱ Time Over (Expired)
          </Text>
          <Text style={[s.sub, { marginBottom: 12, color: '#ff6b6b', fontSize: 12 }]}>
            {timeoutRequests.length} request(s) expired without approval/rejection
          </Text>
          {timeoutRequests.map((r) => (
            <View key={r.id} style={[s.card, { borderLeftWidth: 4, borderLeftColor: '#ff6b6b', backgroundColor: '#fff9f9' }]}>
              <View style={s.cardHeader}>
                <View>
                  <Text style={s.cardDate}>{fmtDate(r.date)}</Text>
                </View>
                <StatusBadge status={r.status} />
              </View>
              <Text style={s.cause} numberOfLines={2}>{r.cause}</Text>
              <View style={s.meta}>
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>Departure</Text>
                  <Text style={s.metaValue}>{r.outTime}</Text>
                </View>
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>Expected By</Text>
                  <Text style={[s.metaValue, { color: '#ff6b6b', fontWeight: 'bold' }]}>{r.expectedReturn}</Text>
                </View>
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>Actual Return</Text>
                  <Text style={s.metaValue}>{r.actualReturn || '—'}</Text>
                </View>
              </View>
              <View style={[s.remarksBox, { backgroundColor: '#ffe5e5', borderLeftColor: '#ff6b6b' }]}>
                <Text style={[s.remarksLabel, { color: '#ff6b6b' }]}>⚠️ Timeout: </Text>
                <Text style={[s.remarksText, { color: '#cc0000' }]}>GSO2 did not approve/reject by {r.expectedReturn} hrs. This request has expired.</Text>
              </View>
              {r.remarks && (
                <View style={s.remarksBox}>
                  <Text style={s.remarksLabel}>Original Remarks: </Text>
                  <Text style={s.remarksText}>{r.remarks}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: COLORS.bg },
  content:      { padding: 16, paddingBottom: 40 },
  heading:      { color: COLORS.gold, fontSize: 18, fontWeight: '800', marginBottom: 2 },
  sub:          { color: COLORS.text3, fontSize: 12, marginBottom: 16 },
  empty:        { alignItems: 'center', marginTop: 60 },
  emptyIcon:    { fontSize: 36, color: COLORS.text3, marginBottom: 10 },
  emptyText:    { color: COLORS.text3, fontSize: 14 },
  card:         { backgroundColor: COLORS.bg2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 12 },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardDate:     { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  cardId:       { color: COLORS.text3, fontSize: 10, marginTop: 2 },
  cause:        { color: COLORS.text2, fontSize: 13, marginBottom: 10 },
  meta:         { flexDirection: 'row', gap: 16, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10 },
  metaItem:     { flex: 1 },
  metaLabel:    { color: COLORS.text3, fontSize: 10, marginBottom: 2 },
  metaValue:    { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  remarksBox:   { flexDirection: 'row', marginTop: 8, backgroundColor: COLORS.amberBg, borderRadius: 6, padding: 8 },
  remarksLabel: { color: COLORS.amber, fontSize: 12, fontWeight: '700' },
  remarksText:  { color: COLORS.amber, fontSize: 12, flex: 1 },
  arrivalTag:   { marginTop: 8, backgroundColor: COLORS.greenBg, borderRadius: 6, padding: 8 },
  arrivalText:  { color: COLORS.green, fontSize: 11, fontWeight: '600' },
});
