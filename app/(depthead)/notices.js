import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl, Modal } from 'react-native';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS } from '../../src/constants/theme';
import { format } from 'date-fns';

const fmtDateTime = (ts) => {
  try { return format(ts.toDate(), 'dd MMM yyyy, HH:mm'); } catch { return '—'; }
};

export default function DeptHeadNotices() {
  const { profile } = useAuth();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'notices'), where('dept', '==', profile.dept || ''), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setNotices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setRefresh(false);
    }, (err) => {
      console.warn('Firestore error:', err.message);
      setLoading(false);
      setRefresh(false);
    });
  }, [profile]);

  async function publish() {
    if (!body.trim()) {
      setFormError('Please enter a message.');
      return;
    }
    setFormError('');
    setPosting(true);
    try {
      await addDoc(collection(db, 'notices'), {
        title: title.trim(),
        body: body.trim(),
        createdBy: profile.uid,
        createdByName: profile.name,
        createdAt: serverTimestamp(),
        dept: profile.dept || '',
      });
      setTitle('');
      setBody('');
    } catch (err) {
      setFormError('Could not publish notice: ' + err.message);
    } finally {
      setPosting(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'notices', deleteId));
      setDeleteId(null);
    } catch (err) {
      setFormError('Could not delete notice: ' + err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ScrollView
      style={s.screen} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => setRefresh(true)} tintColor={COLORS.gold} />}
    >
      <Text style={s.heading}>Notices</Text>
      <Text style={s.sub}>Publish an announcement to students in your department</Text>

      <View style={s.composer}>
        <TextInput
          style={s.titleInput}
          placeholder="Notice title"
          placeholderTextColor={COLORS.text3}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={s.bodyInput}
          placeholder="Write the notice details here..."
          placeholderTextColor={COLORS.text3}
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={4}
        />
        {formError ? <Text style={s.formError}>{formError}</Text> : null}
        <TouchableOpacity style={s.publishBtn} onPress={publish} disabled={posting}>
          {posting ? <ActivityIndicator color="#000" /> : <Text style={s.publishBtnText}> + PUBLISH NOTICE</Text>}
        </TouchableOpacity>
      </View>

      <Text style={s.listHeading}>Previous Notices</Text>

      {loading && <ActivityIndicator color={COLORS.gold} style={{ marginTop: 20 }} />}

      {!loading && notices.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyText}>No notices published yet</Text>
        </View>
      )}

      {notices.map((n) => (
        <View key={n.id} style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>{n.title}</Text>
            <TouchableOpacity onPress={() => setDeleteId(n.id)}>
              <Text style={s.deleteText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.cardBody}>{n.body}</Text>
          <Text style={s.cardMeta}>{n.createdByName} - {n.dept || ' '} · {n.createdAt ? fmtDateTime(n.createdAt) : 'just now'}</Text>
        </View>
      ))}

      <Modal visible={!!deleteId} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Delete Notice</Text>
            <Text style={s.modalSub}>This notice will be removed for students in your department. Continue?</Text>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setDeleteId(null)} disabled={deleting}>
                <Text style={s.btnCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnConfirmDelete} onPress={confirmDelete} disabled={deleting}>
                {deleting ? <ActivityIndicator color="#fff" /> : <Text style={s.btnConfirmDeleteText}>DELETE</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: COLORS.bg },
  content:       { padding: 16, paddingBottom: 40 },
  heading:       { color: COLORS.gold, fontSize: 20, fontWeight: '800', marginBottom: 2 },
  sub:           { color: COLORS.text2, fontSize: 12, marginBottom: 16 },
  composer:      { backgroundColor: COLORS.bg2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 24 },
  titleInput:    { backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, color: COLORS.text, padding: 12, fontSize: 14, fontWeight: '600', marginBottom: 10 },
  bodyInput:     { backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, color: COLORS.text, padding: 12, fontSize: 13, marginBottom: 14, minHeight: 90, textAlignVertical: 'top' },
  formError:     { color: COLORS.red, fontSize: 12, marginBottom: 10 },
  publishBtn:    { backgroundColor: COLORS.gold, borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  publishBtnText:{ color: '#000', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  listHeading:   { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 12 },
  empty:         { alignItems: 'center', marginTop: 30 },
  emptyText:     { color: COLORS.text2, fontSize: 14 },
  card:          { backgroundColor: COLORS.bg2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: COLORS.gold },
  cardHead:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardTitle:     { color: COLORS.text, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 10 },
  deleteText:    { color: COLORS.red, fontSize: 14, fontWeight: '800', padding: 4 },
  cardBody:      { color: COLORS.text2, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  cardMeta:      { color: COLORS.text3, fontSize: 11 },
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modal:         { backgroundColor: COLORS.bg2, borderRadius: 14, padding: 24, borderWidth: 1, borderColor: COLORS.border },
  modalTitle:    { color: COLORS.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  modalSub:      { color: COLORS.text2, fontSize: 12, marginBottom: 18 },
  modalBtns:     { flexDirection: 'row', gap: 10 },
  btnCancel:     { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, alignItems: 'center' },
  btnCancelText: { color: COLORS.text2, fontWeight: '700', fontSize: 12 },
  btnConfirmDelete:     { flex: 1, backgroundColor: COLORS.red, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  btnConfirmDeleteText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
