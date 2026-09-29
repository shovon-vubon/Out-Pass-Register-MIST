import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
} from 'react-native';
import { collection, where, onSnapshot, doc, updateDoc, getDocs, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { getAuth, deleteUser } from 'firebase/auth';
import { db, auth } from '../../firebase';
import { useAuth } from '../../src/context/AuthContext';
import MetricCard from '../../src/components/MetricCard';
import StatusBadge from '../../src/components/StatusBadge';
import { COLORS } from '../../src/constants/theme';
import { format } from 'date-fns';
const fmtDate = d => { try { return format(new Date(d), 'dd MMM yyyy, HH:mm'); } catch { return d || '—'; } };
import { getFunctions, httpsCallable } from "firebase/functions";


export default function AdminDashboard() {
    const { profile } = useAuth();
    const [users,         setUsers]         = useState([]);
    const [refresh,       setRefresh]       = useState(false);
    const [loading,       setLoading]       = useState(true);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const functions = getFunctions();
    const deleteUserAccount = httpsCallable(functions, "deleteUserAccount");

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
    return () => { unsub1(); };
  }, []);

  const handleDelete = async () => {
    if (!selectedStudent) return;

    setDeleting(true);

    try {
      await deleteDoc(doc(db, "users", selectedStudent.id));
      await deleteUserAccount({
        targetUid: selectedStudent.id,
      });

      alert(`Successfully deleted ${selectedStudent.name}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
      setDeleteModalVisible(false);
      setSelectedStudent(null);
    }
  };


    const dept=profile.dept;
    const students   = users.filter(u => u.role === 'student' && u.dept === dept);
    const groupedStudents = students.reduce((groups, student) => {
      const batch = student.batch || 'Unknown';
      if (!groups[batch]) {
        groups[batch] = [];
      }
      groups[batch].push(student);
      return groups;
    }, {});

    const sortedBatches = Object.keys(groupedStudents).sort((a, b) => a.localeCompare(b));

  return (
    <ScrollView
      style={s.screen} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => setRefresh(true)} tintColor={COLORS.gold} />}
    >
        {loading && <ActivityIndicator color={COLORS.gold} style={{ marginTop: 30 }} />}

        <View>
          <Text style={s.sectionTitle}>All Students ({students.length})</Text>
          {sortedBatches.map(batch => (
            <View key={batch} style={s.deptSection}>
              <Text style={s.deptSectionTitle}>Batch: {batch} : ({groupedStudents[batch].length}) Student Officers</Text>
              {groupedStudents[batch].map(student => (
                <View key={student.id} style={s.userCard}>
                  <View style={s.userInfo}>
                    <Text style={s.userName}>{student.name}</Text>
                    <Text style={s.userMeta}>{student.serviceNumber} · {student.rank}</Text>
                    <Text style={s.userEmail}>{student.email}</Text>
                    </View>
                    <View style={s.userActions}>
                      <View style={[s.regStatusBadge, { borderColor: student.regStatus === 'approved' ? COLORS.green : COLORS.red, backgroundColor: student.regStatus === 'approved' ? COLORS.greenBg : COLORS.redBg }]}>
                        <Text style={{ color: student.regStatus === 'approved' ? COLORS.green : COLORS.red, fontSize: 10, fontWeight: '700' }}>{student.regStatus}</Text>
                      </View>
                      <TouchableOpacity style={s.deleteDoc} onPress={() => {
                        setSelectedStudent(student);
                        setDeleteModalVisible(true);
                      }}>
                        <Text style={s.deleteDocText}>🗑 Delete</Text>
                      </TouchableOpacity>
                    </View>
                </View>
              ))}
        </View>
      ))}
      </View>

        <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteModalVisible(false)}>
          <View style={s.modalOverlay}>
            <View style={s.modalContainer}>
              <Text style={s.modalTitle}>Delete Student</Text>
              {selectedStudent && (
                <><Text style={s.modalText}>
                    Are you sure you want to delete this student?
                  </Text>
                  <View style={s.infoBox}>
                    <Text style={s.infoItem}>
                      <Text style={s.label}>Name: </Text>{selectedStudent.name}</Text>
                    <Text style={s.infoItem}><Text style={s.label}>Service No: </Text>{selectedStudent.serviceNumber}</Text>
                    <Text style={s.infoItem}><Text style={s.label}>Department: </Text>{selectedStudent.dept}</Text>
                    <Text style={s.infoItem}>
                      <Text style={s.label}>Email: </Text>
                      {selectedStudent.email}
                    </Text>
                    <Text style={s.infoItem}>
                      <Text style={s.label}>Status: </Text>
                      {selectedStudent.regStatus}
                    </Text>
                  </View>
                </>
              )}
              <View style={s.modalButtons}>
                <TouchableOpacity style={s.cancelBtn}
                  onPress={() => {
                    setDeleteModalVisible(false);
                    setSelectedStudent(null);
                  }}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.deleteBtn} disabled={deleting} onPress={handleDelete}>
                  {deleting ? (<ActivityIndicator color="#fff" />) : (
                    <Text style={s.deleteText}> Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
  deleteDoc:         { backgroundColor: COLORS.redBg, borderWidth: 1, borderColor: COLORS.red, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, minWidth: 84, alignItems: 'center' },
  deleteDocText:     { color: COLORS.red, fontSize: 10, fontWeight: '800' },
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
  userActions:      { gap: 6, alignItems: 'flex-end' },
  approveBtn:       { backgroundColor: COLORS.greenBg, borderWidth: 1, borderColor: COLORS.green, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 },
  approveBtnText:   { color: COLORS.green, fontSize: 10, fontWeight: '800' },
  rejectBtn:        { backgroundColor: COLORS.redBg, borderWidth: 1, borderColor: COLORS.red, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 },
  rejectBtnText:    { color: COLORS.red, fontSize: 10, fontWeight: '800' },
  regStatusBadge:   { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, minWidth: 84, alignItems: 'center' },
  reqCard:          { backgroundColor: COLORS.bg2, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 8 },
  reqHeader:        { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  reqName:          { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  reqMeta:          { color: COLORS.text3, fontSize: 11, marginTop: 2 },
  reqCause:         { color: COLORS.text2, fontSize: 12 },
  modalOverlay:     {  flex: 1,  backgroundColor: "rgba(0,0,0,0.6)",justifyContent: "center",  alignItems: "center",},
  modalContainer:   {  width: "88%",  backgroundColor: COLORS.bg2,borderRadius: 12,  padding: 20,  borderWidth: 1,borderColor: COLORS.border,},
  modalTitle:       {  color: COLORS.red, fontSize: 20,  fontWeight: "700",  marginBottom: 12,},
  modalText:        {  color: COLORS.text,  marginBottom: 15,},
  infoBox:          { backgroundColor: COLORS.bg,borderRadius: 8,  padding: 12,  marginBottom: 20,},
  infoItem:         {  color: COLORS.text,  marginBottom: 6,},
  label:            {  fontWeight: "700",  color: COLORS.gold},
  modalButtons:     {  flexDirection: "row",  justifyContent: "space-between"},
  cancelBtn:        {  flex: 1,  marginRight: 8,  padding: 12,  borderRadius: 8,  borderWidth: 1,  borderColor: COLORS.border,  alignItems: "center",},
  deleteBtn:        {  flex: 1,  marginLeft: 8,  padding: 12,  borderRadius: 8,  backgroundColor: COLORS.red,  alignItems: "center",},
  cancelText:       {  color: COLORS.text, fontWeight: "700",},
  deleteText:       {  color: "#fff",  fontWeight: "700",},
});
