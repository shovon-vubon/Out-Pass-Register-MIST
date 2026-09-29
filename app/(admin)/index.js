import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
} from 'react-native';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDocs, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import MetricCard from '../../src/components/MetricCard';
import StatusBadge from '../../src/components/StatusBadge';
import { COLORS } from '../../src/constants/theme';
import { DEPARTMENTS } from '../../src/constants/config';
import { format } from 'date-fns';

const fmtDate = d => { try { return format(new Date(d), 'dd MMM yyyy, HH:mm'); } catch { return d || '—'; } };

export default function AdminDashboard() {
  const [users,         setUsers]         = useState([]);
  const [requests,      setRequests]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refresh,       setRefresh]       = useState(false);
  const [activeTab,     setActiveTab]     = useState('overview');
  const [rejectModal,   setRejectModal]   = useState(false);
  const [selectedUid,   setSelectedUid]   = useState(null);
  const [busy,          setBusy]          = useState(false);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'users'), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort client-side (not via Firestore orderBy) so accounts created
      // outside the app's own registration flow — which may be missing
      // createdAt — still show up instead of being silently excluded.
      docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setUsers(docs);
      setLoading(false); setRefresh(false);
    }, (err) => {
      console.warn('Firestore error:', err.message);
      setLoading(false); setRefresh(false);
    });
    const unsub2 = onSnapshot(query(collection(db, 'requests'), orderBy('createdAt', 'desc')), (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.warn('Firestore error:', err.message);
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  const students   = users.filter(u => u.role === 'student');
  const gso2list   = users.filter(u => u.role === 'gso2');
  const deptHeads  = users.filter(u => u.role === 'depthead');
  const pendingReg = students.filter(u => u.regStatus === 'pending');

  async function approveUser(uid) {
    setBusy(true);
    await updateDoc(doc(db, 'users', uid), { regStatus: 'approved', approvedAt: serverTimestamp() });
    setBusy(false);
  }

  async function rejectUser(uid) {
    setBusy(true);
    await updateDoc(doc(db, 'users', uid), { regStatus: 'rejected', rejectedAt: serverTimestamp() });
    setBusy(false);
  }

  const TABS = ['overview', 'pending', 'students', 'gso2', 'dept head', 'requests'];

  return (
    <ScrollView
      style={s.screen} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => setRefresh(true)} tintColor={COLORS.gold} />}
    >
      <Text style={s.heading}>Admin Panel</Text>
      <Text style={s.sub}>MIST Officers' Mess · System Monitor</Text>

      {/* Pending registration alert */}
      {pendingReg.length > 0 && (
        <TouchableOpacity style={s.alertBanner} onPress={() => setActiveTab('pending')}>
          <View style={s.notifDot} />
          <Text style={s.alertText}>{pendingReg.length} pending registration(s) awaiting approval</Text>
          <Text style={s.alertArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[s.tab, activeTab === t && s.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[s.tabText, activeTab === t && s.tabTextActive]}>{t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && <ActivityIndicator color={COLORS.gold} style={{ marginTop: 30 }} />}

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <View>
          {DEPARTMENTS.map(dept => {
            const dStudents = students.filter(u => u.dept === dept);
            const approved  = dStudents.filter(u => u.regStatus === 'approved').length;
            const pendingD  = dStudents.filter(u => u.regStatus === 'pending').length;
            const gso2d     = gso2list.filter(u => u.dept === dept);
            const deptHd    = deptHeads.filter(u => u.dept === dept);
            return (
              <View key={dept} style={s.deptCard}>
                <Text style={s.deptName}>{dept}</Text>
                <View style={s.deptStats}>
                  <View style={s.stat}><Text style={s.statVal}>{dStudents.length}</Text><Text style={s.statLabel}>Students</Text></View>
                  <View style={s.stat}><Text style={[s.statVal, { color: COLORS.green }]}>{approved}</Text><Text style={s.statLabel}>Approved</Text></View>
                  <View style={s.stat}><Text style={[s.statVal, { color: COLORS.amber }]}>{pendingD}</Text><Text style={s.statLabel}>Pending</Text></View>
                </View>
                <View style={s.deptPersonnel}>
                  <Text style={s.personnelLabel}>GSO-2: </Text>
                  <Text style={s.personnelVal}>{gso2d.map(g => g.name).join(', ') || 'Not assigned'}</Text>
                </View>
                <View style={s.deptPersonnel}>
                  <Text style={s.personnelLabel}>Dept Head: </Text>
                  <Text style={s.personnelVal}>{deptHd.map(h => h.name).join(', ') || 'Not assigned'}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Pending registrations */}
      {activeTab === 'pending' && (
        <View>
          <Text style={s.sectionTitle}>Pending Registrations ({pendingReg.length})</Text>
          {pendingReg.length === 0 && <Text style={s.empty}>No pending registrations</Text>}
          {pendingReg.map(u => (
            <View key={u.id} style={s.userCard}>
              <View style={s.userInfo}>
                <Text style={s.userName}>{u.name}</Text>
                <Text style={s.userMeta}>{u.serviceNumber} · {u.rank} · {u.dept} · Batch {u.batch}</Text>
                <Text style={s.userEmail}>{u.email}</Text>
                <Text style={s.userDate}>Registered: {u.createdAt?.toDate ? fmtDate(u.createdAt.toDate()) : '—'}</Text>
              </View>
              <View style={s.userActions}>
                <TouchableOpacity style={s.approveBtn} onPress={() => approveUser(u.id)} disabled={busy}>
                  <Text style={s.approveBtnText}>APPROVE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.rejectBtn} onPress={() => rejectUser(u.id)} disabled={busy}>
                  <Text style={s.rejectBtnText}>REJECT</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Students */}
      {activeTab === 'students' && (
        <View>
          <Text style={s.sectionTitle}>All Students ({students.length})</Text>
          {students.map(u => (
            <View key={u.id} style={s.userCard}>
              <View style={s.userInfo}>
                <Text style={s.userName}>{u.name}</Text>
                <Text style={s.userMeta}>{u.serviceNumber} · {u.dept}</Text>
                <Text style={s.userEmail}>{u.email}</Text>
              </View>
              <View style={[s.regStatusBadge, { backgroundColor: u.regStatus === 'approved' ? COLORS.greenBg : u.regStatus === 'rejected' ? COLORS.redBg : COLORS.amberBg, borderColor: u.regStatus === 'approved' ? COLORS.green : u.regStatus === 'rejected' ? COLORS.red : COLORS.amber }]}>
                <Text style={{ color: u.regStatus === 'approved' ? COLORS.green : u.regStatus === 'rejected' ? COLORS.red : COLORS.amber, fontSize: 10, fontWeight: '700' }}>{u.regStatus?.toUpperCase() || 'PENDING'}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* GSO-2 list */}
      {activeTab === 'gso2' && (
        <View>
          <Text style={s.sectionTitle}>GSO-2 Accounts ({gso2list.length})</Text>
          {DEPARTMENTS.map(dept => {
            const dGso2 = gso2list.filter(g => g.dept === dept);
            return (
              <View key={dept} style={s.deptSection}>
                <Text style={s.deptSectionTitle}>DEPT: {dept}</Text>
                {dGso2.length === 0
                  ? <Text style={s.empty}>No GSO-2 assigned</Text>
                  : dGso2.map(g => (
                    <View key={g.id} style={s.userCard}>
                      <View style={s.userInfo}>
                        <Text style={s.userName}>{g.name}</Text>
                        <Text style={s.userMeta}>{g.rank} · {g.email}</Text>
                      </View>
                    </View>
                  ))
                }
              </View>
            );
          })}
        </View>
      )}

      {/* Dept Heads */}
      {activeTab === 'depthead' && (
        <View>
          <Text style={s.sectionTitle}>Department Heads ({deptHeads.length})</Text>
          {deptHeads.map(h => (
            <View key={h.id} style={s.userCard}>
              <View style={s.userInfo}>
                <Text style={s.userName}>{h.name}</Text>
                <Text style={s.userMeta}>{h.rank} · Dept: {h.dept}</Text>
                <Text style={s.userEmail}>{h.email}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* All Requests */}
      {activeTab === 'requests' && (
        <View>
          <Text style={s.sectionTitle}>All Requests ({requests.length})</Text>
          {requests.slice(0, 50).map(r => (
            <View key={r.id} style={s.reqCard}>
              <View style={s.reqHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.reqName}>{r.studentName}</Text>
                  <Text style={s.reqMeta}>{r.serviceNumber} · {r.dept} · {r.date}</Text>
                </View>
                <StatusBadge status={r.status} />
              </View>
              <Text style={s.reqCause} numberOfLines={1}>{r.cause}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:           { flex: 1, backgroundColor: COLORS.bg },
  content:          { padding: 16, paddingBottom: 60 },
  heading:          { color: COLORS.gold, fontSize: 22, fontWeight: '800', marginBottom: 2 },
  sub:              { color: COLORS.text2, fontSize: 12, marginBottom: 16 },
  alertBanner:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.amberBg, borderRadius: 10, borderWidth: 1, borderColor: COLORS.amber, padding: 14, marginBottom: 16 },
  notifDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.amber },
  alertText:        { color: COLORS.amber, fontWeight: '600', fontSize: 13, flex: 1 },
  alertArrow:       { color: COLORS.amber, fontSize: 16, fontWeight: '700' },
  metricsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tabBar:           { marginBottom: 16 },
  tab:              { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, marginRight: 8, backgroundColor: COLORS.bg3 },
  tabActive:        { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  tabText:          { color: COLORS.text2, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  tabTextActive:    { color: '#000' },
  sectionTitle:     { color: COLORS.gold, fontSize: 14, fontWeight: '700', marginBottom: 14, letterSpacing: 0.3 },
  empty:            { color: COLORS.text3, fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  deptCard:         { backgroundColor: COLORS.bg2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: COLORS.gold },
  deptName:         { color: COLORS.gold, fontSize: 15, fontWeight: '800', marginBottom: 10, letterSpacing: 1 },
  deptStats:        { flexDirection: 'row', gap: 16, marginBottom: 10 },
  stat:             { alignItems: 'center' },
  statVal:          { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  statLabel:        { color: COLORS.text3, fontSize: 10, marginTop: 2 },
  deptPersonnel:    { flexDirection: 'row', marginTop: 4 },
  personnelLabel:   { color: COLORS.text2, fontSize: 12, fontWeight: '700' },
  personnelVal:     { color: COLORS.text, fontSize: 12, flex: 1 },
  deptSection:      { marginBottom: 16 },
  deptSectionTitle: { color: COLORS.text2, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  userCard:         { backgroundColor: COLORS.bg2, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  userInfo:         { flex: 1 },
  userName:         { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  userMeta:         { color: COLORS.text2, fontSize: 11, marginTop: 2 },
  userEmail:        { color: COLORS.text3, fontSize: 11, marginTop: 2 },
  userDate:         { color: COLORS.text3, fontSize: 10, marginTop: 2 },
  userActions:      { gap: 6 },
  approveBtn:       { backgroundColor: COLORS.greenBg, borderWidth: 1, borderColor: COLORS.green, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 },
  approveBtnText:   { color: COLORS.green, fontSize: 10, fontWeight: '800' },
  rejectBtn:        { backgroundColor: COLORS.redBg, borderWidth: 1, borderColor: COLORS.red, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 },
  rejectBtnText:    { color: COLORS.red, fontSize: 10, fontWeight: '800' },
  regStatusBadge:   { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  reqCard:          { backgroundColor: COLORS.bg2, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 8 },
  reqHeader:        { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  reqName:          { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  reqMeta:          { color: COLORS.text3, fontSize: 11, marginTop: 2 },
  reqCause:         { color: COLORS.text2, fontSize: 12 },
});
