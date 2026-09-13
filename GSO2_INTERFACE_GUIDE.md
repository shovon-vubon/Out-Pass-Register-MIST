# GSO2 Interface Updates for Time Extension Requests

## Overview
GSO2 users need to be able to review, approve, or reject time extension requests. This guide provides implementation details for updating the GSO2 dashboard/records interface.

## Visual Changes Needed

### 1. Request List Display

#### Regular Request (existing)
```
Officer: John Doe (123456)
Date: 2024-01-15
Departure: 10:00 hrs | Return: 11:00 hrs
Reason: Shopping
Status: Pending
```

#### Time Extension Request (NEW)
```
Officer: John Doe (123456)
Date: 2024-01-15
🔄 TIME EXTENSION REQUEST
Original: 10:00-11:00 hrs
New Request: 11:00-12:00 hrs
↓ Will Merge To: 10:00-12:00 hrs
Reason: [Extended stay]
Status: Pending
```

### 2. Request Detail View

When viewing a time extension request, display:

```
REQUEST TYPE: ⏱ Time Extension
OFFICER: John Doe (123456)
RANK: [Rank]
DEPARTMENT: [Dept]
DATE: 2024-01-15

ORIGINAL REQUEST (To be Updated)
├─ Out Time: 10:00 hrs
├─ Expected Return: 11:00 hrs
└─ Status: Approved

NEW REQUEST (Submitted)
├─ Out Time: 11:00 hrs
├─ Expected Return: 12:00 hrs
└─ Reason: Extended stay

MERGED RESULT (If Approved)
├─ New Out Time: 10:00 hrs ← EARLIEST START
├─ New Expected Return: 12:00 hrs ← LATEST END
└─ Both requests will consolidate to this time

ACTIONS:
[✓ APPROVE & MERGE]  [✗ REJECT]  [💬 REMARKS]
```

## Implementation Steps for GSO2 Interface

### Step 1: Update Records Query
Modify the records/requests query to handle both regular and time-extension requests.

```javascript
// In your GSO2 records component
const fetchRequests = async () => {
  const requestsRef = collection(db, 'requests');
  const q = query(
    requestsRef,
    where('dept', '==', userDept),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  const requests = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  // Separate extension requests to the top
  const extensionRequests = requests.filter(r => r.type === 'time-extension');
  const regularRequests = requests.filter(r => r.type === 'regular' || !r.type);
  
  return [...extensionRequests, ...regularRequests];
};
```

### Step 2: Create Time Extension Request Card Component

```javascript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../src/constants/theme';

export function TimeExtensionRequestCard({ request, onApprove, onReject, onViewDetails }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onViewDetails}>
      {/* Header with Type Badge */}
      <View style={styles.header}>
        <View>
          <Text style={styles.officerName}>{request.studentName}</Text>
          <Text style={styles.serviceNo}>{request.serviceNumber}</Text>
        </View>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>⏱ EXTENSION</Text>
        </View>
      </View>

      {/* Date and Comparison */}
      <Text style={styles.date}>📅 {request.date}</Text>
      
      <View style={styles.timeComparison}>
        <View style={styles.timeColumn}>
          <Text style={styles.timeLabel}>Current Request</Text>
          <Text style={styles.timeValue}>
            {request.originalOutTime} - {request.originalExpectedReturn}
          </Text>
        </View>
        
        <Text style={styles.plusSign}>+</Text>
        
        <View style={styles.timeColumn}>
          <Text style={styles.timeLabel}>New Request</Text>
          <Text style={styles.timeValue}>
            {request.outTime} - {request.expectedReturn}
          </Text>
        </View>
      </View>

      {/* Merge Result */}
      <View style={styles.mergeResult}>
        <Text style={styles.mergeArrow}>↓ WILL MERGE TO ↓</Text>
        <View style={styles.mergedBox}>
          <Text style={styles.mergedTime}>
            {request.mergedOutTime} - {request.mergedExpectedReturn}
          </Text>
        </View>
      </View>

      {/* Reason */}
      <Text style={styles.reason}>📝 {request.cause}</Text>

      {/* Quick Actions */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.actionBtn, styles.approveBtn]}
          onPress={() => onApprove(request)}
        >
          <Text style={styles.approveText}>✓ APPROVE & MERGE</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionBtn, styles.rejectBtn]}
          onPress={() => onReject(request)}
        >
          <Text style={styles.rejectText}>✗ REJECT</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bg2,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.gold,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  officerName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  serviceNo: {
    color: COLORS.text2,
    fontSize: 11,
    marginTop: 2,
  },
  typeBadge: {
    backgroundColor: COLORS.gold + '22',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  typeBadgeText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  date: {
    color: COLORS.text2,
    fontSize: 12,
    marginBottom: 10,
  },
  timeComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.bg3,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  timeColumn: {
    flex: 1,
  },
  timeLabel: {
    color: COLORS.text3,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  timeValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  plusSign: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: '800',
  },
  mergeResult: {
    alignItems: 'center',
    marginBottom: 10,
  },
  mergeArrow: {
    color: COLORS.text2,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 6,
  },
  mergedBox: {
    backgroundColor: COLORS.bg,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.gold,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mergedTime: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '800',
  },
  reason: {
    color: COLORS.text2,
    fontSize: 11,
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  approveBtn: {
    backgroundColor: COLORS.green,
  },
  approveText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  rejectBtn: {
    backgroundColor: COLORS.red,
  },
  rejectText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
```

### Step 3: Update Approval Logic

```javascript
const approveTimeExtension = async (request) => {
  try {
    const requestRef = doc(db, 'requests', request.id);
    
    // Update the extension request as approved
    await updateDoc(requestRef, {
      status: 'approved',
      approvedBy: profile.uid,
      approvedByName: profile.name,
      remarks: 'Time extension approved and merged',
      updatedAt: serverTimestamp(),
    });

    // Cloud Function will automatically:
    // 1. Update original request with merged times
    // 2. Send notification to student

    showAlert('Success', 'Time extension approved! Requests merged.');
    // Refresh the list
    fetchRequests();
  } catch (error) {
    showAlert('Error', 'Failed to approve extension: ' + error.message);
  }
};

const rejectTimeExtension = async (request, remarks = '') => {
  try {
    const requestRef = doc(db, 'requests', request.id);
    
    // Update the extension request as rejected
    await updateDoc(requestRef, {
      status: 'rejected',
      approvedBy: profile.uid,
      approvedByName: profile.name,
      remarks: remarks || 'Time extension rejected',
      updatedAt: serverTimestamp(),
    });

    // Cloud Function will automatically:
    // 1. Notify student of rejection
    // 2. Original request remains unchanged

    showAlert('Success', 'Time extension rejected.');
    // Refresh the list
    fetchRequests();
  } catch (error) {
    showAlert('Error', 'Failed to reject extension: ' + error.message);
  }
};
```

### Step 4: Add Remarks Modal for Rejections

```javascript
import { useState } from 'react';
import { View, Text, TextInput, Modal, TouchableOpacity, StyleSheet } from 'react-native';

export function RemarksModal({ visible, onSubmit, onCancel }) {
  const [remarks, setRemarks] = useState('');

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Add Remarks (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Explain why you're rejecting this extension..."
            placeholderTextColor={COLORS.text3}
            value={remarks}
            onChangeText={setRemarks}
            multiline
            numberOfLines={4}
          />
          <View style={styles.buttons}>
            <TouchableOpacity 
              style={styles.cancelBtn}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.submitBtn}
              onPress={() => {
                onSubmit(remarks);
                setRemarks('');
              }}
            >
              <Text style={styles.submitText}>REJECT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

### Step 5: Filter and Sort Logic

```javascript
// Group requests by type
const groupedRequests = {
  timeExtensions: requests.filter(r => r.type === 'time-extension'),
  regularRequests: requests.filter(r => r.type !== 'time-extension'),
};

// Render with time extensions first (more urgent)
return (
  <ScrollView>
    {groupedRequests.timeExtensions.length > 0 && (
      <>
        <Text style={styles.sectionTitle}>⏱ TIME EXTENSION REQUESTS</Text>
        {groupedRequests.timeExtensions.map(req => (
          <TimeExtensionRequestCard
            key={req.id}
            request={req}
            onApprove={approveTimeExtension}
            onReject={() => setRemarksRequest(req)}
            onViewDetails={() => navigateToDetails(req.id)}
          />
        ))}
      </>
    )}

    {groupedRequests.regularRequests.length > 0 && (
      <>
        <Text style={styles.sectionTitle}>📋 REGULAR REQUESTS</Text>
        {groupedRequests.regularRequests.map(req => (
          <RequestCard
            key={req.id}
            request={req}
            onApprove={() => approveRequest(req)}
            onReject={() => rejectRequest(req)}
            onViewDetails={() => navigateToDetails(req.id)}
          />
        ))}
      </>
    )}
  </ScrollView>
);
```

## Student History View Updates

When displaying a student's request history, show merged requests clearly:

### Before Merge
```
Request 1: 10:00-11:00 hrs (Approved)
Request 2: 11:00-12:00 hrs (Pending Extension)
```

### After Merge
```
Request 1: 10:00-12:00 hrs (Approved) ← Extended
  └─ Original: 10:00-11:00 hrs
  └─ Extended to: 10:00-12:00 hrs
  └─ Extension approved on [date]
```

## Notification Badges

### GSO2 Dashboard
- Add a badge on "Records" showing count of pending time extension requests
- Use different color (gold/amber) for time extension requests
- Update badge in real-time when new extensions arrive

Example:
```
📋 Records (5)
  └─ ⏱ Time Extensions (2)
  └─ Regular Requests (3)
```

## Testing Checklist for GSO2

- [ ] Time extension requests appear at the top of the list
- [ ] Time comparison shows clearly (old + new → merged)
- [ ] Click "APPROVE & MERGE" updates both original and extension requests
- [ ] Original request times change to merged times after approval
- [ ] Click "REJECT" keeps original request unchanged
- [ ] Student receives notification when extension is approved
- [ ] Student receives notification when extension is rejected
- [ ] Works with different time ranges (adjacent, overlapping)
- [ ] Remarks are properly saved with rejections
- [ ] GSO2 can view full details in a detailed modal
- [ ] Filtering by status (pending, approved, rejected) works correctly

## API Contracts

### Cloud Function Triggers (Auto-handled)

**On Extension Approval:**
- Original request updated with merged times
- Student notification sent automatically

**On Extension Rejection:**
- Extension request marked rejected
- Original request remains unchanged
- Student notification sent automatically

No additional API calls needed for these - Firestore triggers handle everything!

## Future Enhancements

1. **Bulk Actions**: Approve/reject multiple extensions at once
2. **Analytics Dashboard**: Show extension request statistics
3. **Auto-Suggestions**: Suggest to GSO2 which overlapping requests to merge
4. **Timeline View**: Visual calendar showing time ranges
5. **Export Report**: Export extension requests for record keeping
6. **Escalation**: Auto-escalate if extension pending > 24 hours
