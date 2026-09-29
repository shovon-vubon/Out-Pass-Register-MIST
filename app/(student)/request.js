import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS } from '../../src/constants/theme';
import { getPriority } from '../../src/utils/priority';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Pressable } from 'react-native';

const todayStr = () => new Date().toISOString().slice(0, 10);

// Helper function to convert time string (HH:MM) to minutes since midnight
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// Helper function to check if two time ranges overlap or are adjacent
const isTimeRangeOverlapOrAdjacent = (existingStart, existingEnd, newStart, newEnd) => {
  const existStart = timeToMinutes(existingStart);
  const existEnd = timeToMinutes(existingEnd);
  const newStartMin = timeToMinutes(newStart);
  const newEndMin = timeToMinutes(newEnd);

  // Check for overlap or adjacency (touching at boundaries)
  // Overlap if: new starts before existing ends AND new ends after existing starts
  // Adjacent if: new starts exactly when existing ends OR new ends exactly when existing starts
  return !(newEndMin < existStart || newStartMin > existEnd);
};

// Helper function to merge two time ranges
const mergeTimeRanges = (start1, end1, start2, end2) => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  const mergedStart = Math.min(s1, s2);
  const mergedEnd = Math.max(e1, e2);

  const toTimeStr = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  return {
    start: toTimeStr(mergedStart),
    end: toTimeStr(mergedEnd),
  };
};

// Helper function to find existing requests for the student on the same date
const findExistingRequest = async (studentId, date) => {
  try {
    const requestsQuery = query(
      collection(db, 'requests'),
      where('studentId', '==', studentId),
      where('date', '==', date),
      where('status', 'in', ['pending', 'approved'])
    );
    const snapshot = await getDocs(requestsQuery);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error finding existing request:', error);
    return [];
  }
};

export default function StudentRequest() {
  const { profile } = useAuth();
  const router = useRouter();
  const [date, setDate]           = useState(todayStr());
  const [outTime, setOutTime]     = useState('');
  const [returnTime, setReturn]   = useState('');
  const [cause, setCause]         = useState('');
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState('');
  const [showConfirm, setConfirm] = useState(false);
  const [success, setSuccess]     = useState(false);
  const [showOutPicker, setShowOutPicker] = useState(false);
  const [showReturnPicker, setShowReturnPicker] = useState(false);
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [selectedReason, setSelectedReason]     = useState('');
  const [showTip, setShowTip]     = useState(false);
  const [existingRequest, setExistingRequest] = useState(null);
  const [isTimeExtension, setIsTimeExtension] = useState(false);
  const [mergedTimes, setMergedTimes] = useState(null);
  const tipTimer = React.useRef(null);

  const toggleTip = () => {
    clearTimeout(tipTimer.current);
    setShowTip(true);
    tipTimer.current = setTimeout(() => setShowTip(false), 4000);
  };

  const REASONS = ['Medical Emergency', 'Family Meeting', 'Blood Donation', 'Visiting Restaurant','Attending Wedding','Shopping','Other'];

  // Custom Time Picker Modal Component
  const TimeModal = ({ visible, value, onSelect, onClose, title }) => {
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minutes = ['00', '10', '20','30', '40', '50'];

    const [h, m] = (value || '12:00').split(':');
    const [selH, setSelH] = useState(h);
    const [selM, setSelM] = useState(m);

    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>{title}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 20 }}>
              <View style={{ width: '45%' }}>
                <Text style={s.label}>Hour</Text>
                <ScrollView style={{ height: 150 }} nestedScrollEnabled>
                  {hours.map(item => (
                    <TouchableOpacity
                      key={item}
                      onPress={() => setSelH(item)}
                      style={[s.timeItem, selH === item && s.timeItemSel]}
                    >
                      <Text style={[s.timeItemText, selH === item && s.timeItemTextSel]}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ width: '45%' }}>
                <Text style={s.label}>Minute</Text>
                <ScrollView style={{ height: 150 }} nestedScrollEnabled>
                  {minutes.map(item => (
                    <TouchableOpacity
                      key={item}
                      onPress={() => setSelM(item)}
                      style={[s.timeItem, selM === item && s.timeItemSel]}
                    >
                      <Text style={[s.timeItemText, selM === item && s.timeItemTextSel]}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.btnGhost2} onPress={onClose}>
                <Text style={s.btnGhostText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnGold2} onPress={() => onSelect(`${selH}:${selM}`)}>
                <Text style={s.btnGoldText}>SET TIME</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Custom Reason Picker Modal Component
  const ReasonModal = ({ visible, onSelect, onClose }) => {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Select Reason</Text>
            <ScrollView style={{ maxHeight: 300, marginVertical: 15 }}>
              {REASONS.map(item => (
                <TouchableOpacity
                  key={item}
                  onPress={() => onSelect(item)}
                  style={[s.timeItem, selectedReason === item && s.timeItemSel]}
                >
                  <Text style={[s.timeItemText, selectedReason === item && s.timeItemTextSel]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.btnGhost2} onPress={onClose}>
              <Text style={s.btnGhostText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  useFocusEffect(useCallback(() => {
    setDate(todayStr());
    setOutTime('');
    setReturn('');
    setCause('');
    setSelectedReason('');
    setError('');
    setSuccess(false);
    setBusy(false);
    setConfirm(false);
    setShowTip(false);
    setExistingRequest(null);
    setIsTimeExtension(false);
    setMergedTimes(null);
    return () => clearTimeout(tipTimer.current);
  }, []));

  const isCurfew = () => {
    if (!returnTime) return false;
    const [h, m] = returnTime.split(':').map(Number);
    return h > 22 || (h === 22 && m > 0);
  };

  // Helper function to get current time in HH:MM format
  const getCurrentTime = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  // Helper function to check if departure time is valid (not before current time when today)
  const isDepartureTimeValid = () => {
    const today = todayStr();
    if (date === today) {
      const currentTime = getCurrentTime();
      return timeToMinutes(outTime) >= timeToMinutes(currentTime);
    }
    return true; // Future dates are always valid
  };

  // Helper function to check if return time is after departure time
  const isReturnTimeValid = () => {
    return timeToMinutes(returnTime) > timeToMinutes(outTime);
  };

  function openConfirm() {
    if (!date || !outTime || !returnTime || !cause.trim()) {
      setError('All fields are required.'); 
      return;
    }

    // Validate departure time is not before current time (when date is today)
    if (!isDepartureTimeValid()) {
      setError(`Departure time cannot be before current time (${getCurrentTime()} hrs).`);
      return;
    }

    // Validate return time is after departure time
    if (!isReturnTimeValid()) {
      setError('Return time must be after departure time.');
      return;
    }

    setError(''); 
    
    // Check for existing requests and time extension
    checkForTimeExtension();
    setConfirm(true);
  }

  async function checkForTimeExtension() {
    try {
      const existing = await findExistingRequest(profile.uid, date);
      if (existing.length > 0) {
        const existingReq = existing[0];
        const hasOverlap = isTimeRangeOverlapOrAdjacent(
          existingReq.outTime,
          existingReq.expectedReturn,
          outTime,
          returnTime
        );
        
        if (hasOverlap) {
          const merged = mergeTimeRanges(
            existingReq.outTime,
            existingReq.expectedReturn,
            outTime,
            returnTime
          );
          setExistingRequest(existingReq);
          setIsTimeExtension(true);
          setMergedTimes(merged);
          return;
        }
      }
      setExistingRequest(null);
      setIsTimeExtension(false);
      setMergedTimes(null);
    } catch (error) {
      console.error('Error checking for time extension:', error);
    }
  }

  const formatTime = (date) => {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  async function doSubmit() {
    setBusy(true); setConfirm(false);
    try {
      // Notify GSO-2 by looking up their fcmToken
      const gso2Query = query(collection(db, 'users'), where('role', '==', 'gso2'), where('dept', '==', profile.dept));
      const gso2Snap  = await getDocs(gso2Query);
      const gso2Tokens = gso2Snap.docs.map(d => d.data().fcmToken).filter(Boolean);

      if (isTimeExtension && existingRequest) {
        // Create a time-extension request that references the original request
        await addDoc(collection(db, 'requests'), {
          studentId:      profile.uid,
          studentName:    profile.name,
          serviceNumber:  profile.serviceNumber,
          rank:           profile.rank,
          dept:           profile.dept,
          date,
          outTime,
          expectedReturn: returnTime,
          actualReturn:   null,
          cause:          cause.trim(),
          priority:       getPriority(cause.trim()),
          status:         'pending',
          approvedBy:     null,
          approvedByName: null,
          remarks:        null,
          arrivalSent:    false,
          arrivalTime:    null,
          notifyTokens:   gso2Tokens,
          type:           'time-extension',
          originalRequestId: existingRequest.id,
          originalOutTime: existingRequest.outTime,
          originalExpectedReturn: existingRequest.expectedReturn,
          mergedOutTime:  mergedTimes.start,
          mergedExpectedReturn: mergedTimes.end,
          createdAt:      serverTimestamp(),
        });
      } else {
        // Create a regular request
        await addDoc(collection(db, 'requests'), {
          studentId:      profile.uid,
          studentName:    profile.name,
          serviceNumber:  profile.serviceNumber,
          rank:           profile.rank,
          dept:           profile.dept,
          date,
          outTime,
          expectedReturn: returnTime,
          actualReturn:   null,
          cause:          cause.trim(),
          priority:       getPriority(cause.trim()),
          status:         'pending',
          approvedBy:     null,
          approvedByName: null,
          remarks:        null,
          arrivalSent:    false,
          arrivalTime:    null,
          notifyTokens:   gso2Tokens,
          type:           'regular',
          createdAt:      serverTimestamp(),
        });
      }

      // Firestore trigger (Cloud Function) will send push to GSO-2
      setSuccess(true);
      setTimeout(() => router.replace('/(student)/history'), 1500);
    } catch (e) {
      setError('Failed to submit. Please try again.');
    }
    setBusy(false);
  }

  if (success) {
    return (
      <View style={s.center}>
        <Text style={s.successIcon}>✓</Text>
        <Text style={s.successText}>Request submitted!</Text>
        <Text style={s.successSub}>Your GSO-2 has been notified.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Text style={s.cardTitle}>⊕ New Out-of-Mess Request</Text>
          <Text style={s.cardSub}>Returns after 2200 hrs require GSO-2 approval.</Text>

          <Text style={s.label}>Date *</Text>
          <TextInput
            style={s.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.text3}
            editable={false}
            {...Platform.select({ web: { type: 'date' } })}
          />

          <Text style={s.label}>Departure Time (HH:MM) *</Text>
          {date === todayStr() && (
            <Text style={[s.hint, { color: COLORS.text3, marginBottom: 8 }]}>
              Current time: {getCurrentTime()} hrs
            </Text>
          )}
          <TouchableOpacity style={s.pickerTrigger} onPress={() => setShowOutPicker(true)}>
            <Text style={[s.pickerTriggerText, !outTime && { color: COLORS.text3 }]}>
              {outTime ? `${outTime} hrs` : 'Select Departure Time'}
            </Text>
          </TouchableOpacity>

          {outTime && date === todayStr() && timeToMinutes(outTime) < timeToMinutes(getCurrentTime()) && (
            <View style={s.errorBox}>
              <Text style={s.errorBoxText}>⚠ Departure time must be at or after current time ({getCurrentTime()} hrs)</Text>
            </View>
          )}

          <TimeModal
            visible={showOutPicker}
            title="Departure Time"
            value={outTime}
            onSelect={(val) => { setOutTime(val); setShowOutPicker(false); }}
            onClose={() => setShowOutPicker(false)}
          />

          <Text style={s.label}>Expected Return Time (HH:MM) *</Text>
          {outTime && (
            <Text style={[s.hint, { color: COLORS.text3, marginBottom: 8 }]}>
              Must be after departure time: {outTime} hrs
            </Text>
          )}
          <TouchableOpacity style={s.pickerTrigger} onPress={() => setShowReturnPicker(true)}>
            <Text style={[s.pickerTriggerText, !returnTime && { color: COLORS.text3 }]}>
              {returnTime ? `${returnTime} hrs` : 'Select Return Time'}
            </Text>
          </TouchableOpacity>

          {returnTime && outTime && timeToMinutes(returnTime) <= timeToMinutes(outTime) && (
            <View style={s.errorBox}>
              <Text style={s.errorBoxText}>⚠ Return time must be after departure time ({outTime} hrs)</Text>
            </View>
          )}

          <TimeModal
            visible={showReturnPicker}
            title="Expected Return Time"
            value={returnTime}
            onSelect={(val) => { setReturn(val); setShowReturnPicker(false); }}
            onClose={() => setShowReturnPicker(false)}
          />
          {isCurfew() && (
            <View style={s.warnBox}>
              <Text style={s.warnText}>⚠ Return after 2200 hrs — GSO-2 approval required.</Text>
            </View>
          )}

          <Text style={s.label}>Reason / Cause *</Text>
          <TouchableOpacity style={s.pickerTrigger} onPress={() => setShowReasonPicker(true)}>
            <Text style={[s.pickerTriggerText, !selectedReason && { color: COLORS.text3 }]}>
              {selectedReason || 'Select Reason'}
            </Text>
          </TouchableOpacity>

          <ReasonModal
            visible={showReasonPicker}
            onSelect={(val) => {
              setSelectedReason(val);
              setShowReasonPicker(false);
              if (val !== 'Other') setCause(val);
              else setCause('');
            }}
            onClose={() => setShowReasonPicker(false)}
          />

          {selectedReason === 'Other' && (
            <>
              <View style={s.tipRow}>
                <Text style={s.tipRowLabel}>Priority is set from keywords in your text</Text>
                <TouchableOpacity style={s.infoBtn} onPress={toggleTip}>
                  <Text style={s.infoBtnText}>i</Text>
                </TouchableOpacity>
              </View>
              {showTip && (
                <View style={s.tipBox}>
                  <Text style={s.tipText}>
                    Include "emg" or "emergency" for HIGH priority.{'\n'}
                    Include "mdm" or "medium" for MEDIUM priority.{'\n'}
                    Otherwise your request is treated as LOW priority.
                  </Text>
                </View>
              )}
              <TextInput
                style={[s.input, s.textarea]} placeholderTextColor={COLORS.text3}
                placeholder="State your reason clearly…"
                value={cause} onChangeText={setCause} multiline numberOfLines={4}
              />
            </>
          )}

          {!!error && <Text style={s.error}>{error}</Text>}

          <View style={s.btnRow}>
            <TouchableOpacity style={s.btnGold} onPress={openConfirm} disabled={busy}>
              <Text style={s.btnGoldText}>REVIEW & SUBMIT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnGhost} onPress={() => router.back()}>
              <Text style={s.btnGhostText}>CANCEL</Text>
            </TouchableOpacity>
          </View>

          <View style={s.infoBox}>
            <Text style={s.infoText}>
              Your GSO-2 for <Text style={{ color: COLORS.gold }}>{profile?.dept}</Text> will receive an instant notification upon submission.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Confirm Modal */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>
              {isTimeExtension ? '⏱ Time Extension Request' : 'Confirm Request'}
            </Text>
            <Text style={s.modalSub}>
              {isTimeExtension 
                ? 'Your existing request will be merged if approved.' 
                : 'Review before submitting. GSO-2 will be notified immediately.'}
            </Text>
            
            {isTimeExtension && existingRequest && (
              <View style={s.extensionBox}>
                <Text style={s.extensionTitle}>Existing Request:</Text>
                <View style={s.timeCompare}>
                  <View style={s.timeBlock}>
                    <Text style={s.timeLabel}>Current</Text>
                    <Text style={s.timeValue}>{existingRequest.outTime} → {existingRequest.expectedReturn}</Text>
                  </View>
                  <Text style={s.plusIcon}>+</Text>
                  <View style={s.timeBlock}>
                    <Text style={s.timeLabel}>New</Text>
                    <Text style={s.timeValue}>{outTime} → {returnTime}</Text>
                  </View>
                </View>
                {mergedTimes && (
                  <>
                    <View style={s.arrowSeparator}>
                      <Text style={s.arrowText}>↓ Will merge to ↓</Text>
                    </View>
                    <View style={s.mergedBox}>
                      <Text style={s.timeLabel}>Merged Time</Text>
                      <Text style={s.mergedTimeValue}>{mergedTimes.start} → {mergedTimes.end}</Text>
                    </View>
                  </>
                )}
              </View>
            )}
            
            <View style={s.confirmRows}>
              {isTimeExtension
                ? [['Officer', `${profile?.name} (${profile?.serviceNumber})`], ['Department', profile?.dept], ['Date', date], ['New Time', outTime + ' → ' + returnTime], ['Reason', cause]].map(([k, v]) => (
                    <View key={k} style={s.confirmRow}>
                      <Text style={s.confirmKey}>{k}</Text>
                      <Text style={s.confirmVal}>{v}</Text>
                    </View>
                  ))
                : [['Officer', `${profile?.name} (${profile?.serviceNumber})`], ['Department', profile?.dept], ['Date', date], ['Departure', outTime + ' hrs'], ['Return by', returnTime + ' hrs'], ['Reason', cause]].map(([k, v]) => (
                    <View key={k} style={s.confirmRow}>
                      <Text style={s.confirmKey}>{k}</Text>
                      <Text style={s.confirmVal}>{v}</Text>
                    </View>
                  ))
              }
            </View>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.btnGhost2} onPress={() => setConfirm(false)}>
                <Text style={s.btnGhostText}>GO BACK</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnGold2} onPress={doSubmit} disabled={busy}>
                {busy ? <ActivityIndicator color="#000" /> : <Text style={s.btnGoldText}>{isTimeExtension ? 'REQUEST EXTENSION' : 'CONFIRM & SUBMIT'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: COLORS.bg },
  content:     { padding: 16, paddingBottom: 40 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  successIcon: { fontSize: 48, color: COLORS.green, marginBottom: 12 },
  successText: { color: COLORS.green, fontSize: 20, fontWeight: '800', marginBottom: 6 },
  successSub:  { color: COLORS.text2, fontSize: 13 },
  card:        { backgroundColor: COLORS.bg2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 20 },
  cardTitle:   { color: COLORS.gold, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardSub:     { color: COLORS.text3, fontSize: 12, marginBottom: 18 },
  label:       { color: COLORS.text2, fontSize: 12, marginBottom: 6 },
  input:       { backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, color: COLORS.text, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, marginBottom: 12 },
  pickerTrigger: { backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12, justifyContent: 'center' },
  pickerTriggerText: { color: COLORS.text, fontSize: 14 },
  timeItem:    { paddingVertical: 10, alignItems: 'center', borderRadius: 6, marginBottom: 4 },
  timeItemSel: { backgroundColor: COLORS.gold + '33', borderWidth: 1, borderColor: COLORS.gold },
  timeItemText: { color: COLORS.text2, fontSize: 16 },
  timeItemTextSel: { color: COLORS.gold, fontWeight: '700' },
  textarea:    { height: 90, textAlignVertical: 'top' },
  tipRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  tipRowLabel: { color: COLORS.text3, fontSize: 11, flex: 1 },
  infoBtn:     { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  infoBtnText: { color: COLORS.gold, fontSize: 11, fontWeight: '800' },
  tipBox:      { backgroundColor: COLORS.bg3, borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: COLORS.gold },
  tipText:     { color: COLORS.text2, fontSize: 11, lineHeight: 16 },
  warnBox:     { backgroundColor: COLORS.amberBg, borderRadius: 6, padding: 8, marginBottom: 10, borderWidth: 1, borderColor: COLORS.amber },
  warnText:    { color: COLORS.amber, fontSize: 12 },
  hint:        { color: COLORS.text3, fontSize: 11, fontStyle: 'italic', marginBottom: 6 },
  errorBox:    { backgroundColor: '#ffebee', borderRadius: 6, padding: 10, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: COLORS.red, borderWidth: 1, borderColor: '#ffcccc' },
  errorBoxText: { color: '#c62828', fontSize: 12, fontWeight: '500' },
  error:       { color: COLORS.red, fontSize: 12, marginBottom: 10 },
  btnRow:      { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnGold:     { flex: 1, backgroundColor: COLORS.gold, borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  btnGoldText: { color: '#000', fontWeight: '800', fontSize: 12 },
  btnGhost:    { paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, alignItems: 'center' },
  btnGhostText:{ color: COLORS.text2, fontWeight: '700', fontSize: 12 },
  infoBox:     { marginTop: 16, backgroundColor: COLORS.bg3, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  infoText:    { color: COLORS.text3, fontSize: 11, lineHeight: 17 },
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modal:       { backgroundColor: COLORS.bg2, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 24 },
  modalTitle:  { color: COLORS.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  modalSub:    { color: COLORS.text2, fontSize: 12, marginBottom: 16 },
  confirmRows: { gap: 8, marginBottom: 20 },
  confirmRow:  { flexDirection: 'row', gap: 12 },
  confirmKey:  { color: COLORS.text2, fontSize: 12, fontWeight: '600', width: 90 },
  confirmVal:  { color: COLORS.text, fontSize: 12, flex: 1 },
  modalBtns:   { flexDirection: 'row', gap: 10 },
  btnGhost2:   { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, alignItems: 'center' },
  btnGold2:    { flex: 1, backgroundColor: COLORS.gold, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  extensionBox: { backgroundColor: COLORS.bg3, borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: COLORS.gold },
  extensionTitle: { color: COLORS.gold, fontSize: 12, fontWeight: '700', marginBottom: 10 },
  timeCompare: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  timeBlock: { flex: 1, backgroundColor: COLORS.bg, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: COLORS.border },
  timeLabel: { color: COLORS.text3, fontSize: 10, marginBottom: 4, fontWeight: '600' },
  timeValue: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  plusIcon: { color: COLORS.gold, fontSize: 18, fontWeight: '800' },
  arrowSeparator: { alignItems: 'center', marginVertical: 10 },
  arrowText: { color: COLORS.text2, fontSize: 11, fontWeight: '600' },
  mergedBox: { backgroundColor: COLORS.bg, borderRadius: 8, padding: 12, borderWidth: 2, borderColor: COLORS.gold },
  mergedTimeValue: { color: COLORS.gold, fontSize: 14, fontWeight: '800', marginTop: 6 },
});
