# Student History View Updates for Time Extensions

## Overview
When students view their request history, they should see time-merged requests clearly indicated and understand how their requests were consolidated.

## Request History Display

### Regular Request (Existing)
```
Request ID: REQ-2024-001
Date: January 15, 2024
Departure: 10:00 hrs
Expected Return: 11:00 hrs
Reason: Shopping
Status: ✓ Approved
Approved by: Sgt. Kumar (GSO2)
Approved on: Jan 15, 2024 14:30
```

### Merged Request (NEW)
```
Request ID: REQ-2024-001
Date: January 15, 2024
Departure: 10:00 hrs → 12:00 hrs ⏱ EXTENDED
Expected Return: 11:00 hrs → 12:00 hrs
Reason: Shopping
Status: ✓ Approved (Extended)
Approved by: Sgt. Kumar (GSO2)

EXTENSION DETAILS:
├─ Original Request: 10:00 - 11:00 hrs
├─ Extension Request: 11:00 - 12:00 hrs
├─ Merged Result: 10:00 - 12:00 hrs
└─ Extension Approved: Jan 15, 2024 15:45 by Sgt. Kumar

Arrival:
└─ Student must check-in by 12:00 hrs
```

## Implementation for History Component

### Step 1: Update Request Display Component

```javascript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../src/constants/theme';

export function RequestHistoryCard({ request }) {
  const isExtended = request.originalOutTime && request.mergedOutTime;
  
  return (
    <TouchableOpacity style={[styles.card, isExtended && styles.cardExtended]}>
      {/* Header with Request ID and Status */}
      <View style={styles.header}>
        <View>
          <Text style={styles.requestId}>REQ-{request.createdAt.toDate().getFullYear()}-{request.id.slice(0, 6).toUpperCase()}</Text>
          <Text style={styles.date}>📅 {request.date}</Text>
        </View>
        <View style={[styles.statusBadge, styles[`status${request.status}`]]}>
          <Text style={styles.statusText}>
            {request.status === 'approved' ? '✓' : request.status === 'pending' ? '⏳' : '✗'}
            {' ' + request.status.toUpperCase()}
            {isExtended && ' (EXT)'}
          </Text>
        </View>
      </View>

      {/* Time Display */}
      {isExtended ? (
        <View style={styles.timeExtended}>
          <View style={styles.timeChangeBox}>
            <View style={styles.timeChange}>
              <Text style={styles.timeChangeLabel}>DEPARTURE</Text>
              <View style={styles.timeChangeRow}>
                <Text style={styles.timeOld}>{request.originalOutTime}</Text>
                <Text style={styles.arrow}>→</Text>
                <Text style={styles.timeNew}>{request.mergedOutTime}</Text>
              </View>
            </View>
            
            <View style={styles.timeChange}>
              <Text style={styles.timeChangeLabel}>RETURN</Text>
              <View style={styles.timeChangeRow}>
                <Text style={styles.timeOld}>{request.originalExpectedReturn}</Text>
                <Text style={styles.arrow}>→</Text>
                <Text style={styles.timeNew}>{request.mergedExpectedReturn}</Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.timeNormal}>
          <Text style={styles.timeLabel}>Time Out</Text>
          <Text style={styles.timeValue}>{request.outTime} hrs</Text>
          <Text style={styles.timeLabel} style={{ marginTop: 8 }}>Expected Return</Text>
          <Text style={styles.timeValue}>{request.expectedReturn} hrs</Text>
        </View>
      )}

      {/* Reason */}
      <View style={styles.reasonBox}>
        <Text style={styles.reasonLabel}>Reason</Text>
        <Text style={styles.reasonText}>{request.cause}</Text>
      </View>

      {/* Extension Details (if extended) */}
      {isExtended && (
        <View style={styles.extensionDetails}>
          <Text style={styles.extensionTitle}>⏱ EXTENSION DETAILS</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Original Request</Text>
            <Text style={styles.detailValue}>{request.originalOutTime} - {request.originalExpectedReturn}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Extension Request</Text>
            <Text style={styles.detailValue}>{request.outTime} - {request.expectedReturn}</Text>
          </View>
          
          <View style={[styles.detailRow, styles.mergedDetailRow]}>
            <Text style={styles.detailLabel}>Merged Result</Text>
            <Text style={styles.mergedDetailValue}>{request.mergedOutTime} - {request.mergedExpectedReturn}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Approved</Text>
            <Text style={styles.detailValue}>
              {new Date(request.updatedAt.toDate()).toLocaleString()} by {request.approvedByName}
            </Text>
          </View>
        </View>
      )}

      {/* Approval Info */}
      <View style={styles.approvalBox}>
        <Text style={styles.approvalLabel}>Approval Information</Text>
        <View style={styles.approvalRow}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{request.status.charAt(0).toUpperCase() + request.status.slice(1)}</Text>
        </View>
        
        {request.approvedByName && (
          <View style={styles.approvalRow}>
            <Text style={styles.label}>Approved By</Text>
            <Text style={styles.value}>{request.approvedByName}</Text>
          </View>
        )}
        
        {request.remarks && (
          <View style={styles.approvalRow}>
            <Text style={styles.label}>Remarks</Text>
            <Text style={styles.value}>{request.remarks}</Text>
          </View>
        )}
        
        {request.status === 'pending' && (
          <Text style={styles.pendingNote}>⏳ Waiting for GSO-2 approval</Text>
        )}
      </View>

      {/* Arrival Status */}
      {request.status === 'approved' && (
        <View style={styles.arrivalBox}>
          <Text style={styles.arrivalLabel}>Arrival Status</Text>
          {request.arrivalTime ? (
            <View>
              <Text style={styles.arrivalTime}>✓ Checked in at {request.arrivalTime}</Text>
              <Text style={styles.arrivalNote}>You must return by {isExtended ? request.mergedExpectedReturn : request.expectedReturn} hrs</Text>
            </View>
          ) : (
            <Text style={styles.arrivalPending}>
              ⏳ Remember to check in by {isExtended ? request.mergedExpectedReturn : request.expectedReturn} hrs
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bg2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  cardExtended: {
    borderColor: COLORS.gold,
    borderWidth: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  requestId: {
    color: COLORS.text3,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  date: {
    color: COLORS.text2,
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusapproved: {
    backgroundColor: COLORS.green + '22',
    borderColor: COLORS.green,
  },
  statuspending: {
    backgroundColor: COLORS.amber + '22',
    borderColor: COLORS.amber,
  },
  statusrejected: {
    backgroundColor: COLORS.red + '22',
    borderColor: COLORS.red,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Time Display Styles
  timeExtended: {
    backgroundColor: COLORS.bg3,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.gold + '44',
  },
  timeChangeBox: {
    gap: 10,
  },
  timeChange: {
    flex: 1,
  },
  timeChangeLabel: {
    color: COLORS.text3,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  timeChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeOld: {
    color: COLORS.text2,
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  arrow: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  timeNew: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '800',
  },

  timeNormal: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.bg3,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  timeLabel: {
    color: COLORS.text3,
    fontSize: 10,
    fontWeight: '600',
  },
  timeValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },

  // Reason Box
  reasonBox: {
    backgroundColor: COLORS.bg3,
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  reasonLabel: {
    color: COLORS.text3,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  reasonText: {
    color: COLORS.text,
    fontSize: 12,
  },

  // Extension Details
  extensionDetails: {
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold,
    padding: 10,
    marginBottom: 10,
  },
  extensionTitle: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    color: COLORS.text2,
    fontSize: 10,
    fontWeight: '600',
  },
  detailValue: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '600',
  },
  mergedDetailRow: {
    backgroundColor: COLORS.bg3,
    marginHorizontal: -10,
    marginVertical: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  mergedDetailValue: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '800',
  },

  // Approval Box
  approvalBox: {
    backgroundColor: COLORS.bg3,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  approvalLabel: {
    color: COLORS.text2,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  approvalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    color: COLORS.text3,
    fontSize: 10,
  },
  value: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '600',
  },
  pendingNote: {
    color: COLORS.amber,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },

  // Arrival Box
  arrivalBox: {
    backgroundColor: COLORS.green + '11',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.green + '44',
    padding: 10,
  },
  arrivalLabel: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  arrivalTime: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: '600',
  },
  arrivalPending: {
    color: COLORS.text2,
    fontSize: 11,
  },
  arrivalNote: {
    color: COLORS.text3,
    fontSize: 10,
    marginTop: 4,
  },
});
```

### Step 2: Query Students' Requests

Update the history query to fetch requests with extension details:

```javascript
const fetchStudentRequests = async () => {
  const requestsQuery = query(
    collection(db, 'requests'),
    where('studentId', '==', profile.uid),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(requestsQuery);
  const requests = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Group by original request if extension exists
  const groupedRequests = {};
  const regularRequests = [];

  requests.forEach(req => {
    if (req.type === 'time-extension') {
      // This is an extension request - group with original
      if (!groupedRequests[req.originalRequestId]) {
        groupedRequests[req.originalRequestId] = {
          original: null,
          extensions: []
        };
      }
      groupedRequests[req.originalRequestId].extensions.push(req);
    } else if (req.type === 'regular' || !req.type) {
      // Check if this request has any extensions
      if (groupedRequests[req.id]) {
        groupedRequests[req.id].original = req;
      } else {
        regularRequests.push(req);
      }
    }
  });

  // Merge extension requests into original request
  const mergedRequests = [];
  Object.values(groupedRequests).forEach(group => {
    if (group.original && group.extensions.length > 0) {
      const approvedExtension = group.extensions.find(e => e.status === 'approved');
      if (approvedExtension) {
        mergedRequests.push({
          ...group.original,
          originalOutTime: group.original.outTime,
          originalExpectedReturn: group.original.expectedReturn,
          outTime: approvedExtension.outTime,
          expectedReturn: approvedExtension.expectedReturn,
          mergedOutTime: approvedExtension.mergedOutTime,
          mergedExpectedReturn: approvedExtension.mergedExpectedReturn,
          isExtended: true,
          extensionApprovedAt: approvedExtension.updatedAt,
        });
      }
    }
  });

  return [...mergedRequests, ...regularRequests];
};
```

### Step 3: Filter Options

```javascript
const [filterStatus, setFilterStatus] = useState('all'); // all, pending, approved, rejected
const [showExtendedOnly, setShowExtendedOnly] = useState(false);

const filteredRequests = requests.filter(req => {
  if (filterStatus !== 'all' && req.status !== filterStatus) return false;
  if (showExtendedOnly && !req.isExtended) return false;
  return true;
});
```

## Display Indicators

### Visual Indicators for Extended Requests
- **Border**: Gold/amber colored border (2px width)
- **Badge**: "⏱ EXTENDED" label in status
- **Timeline**: Show before/after times with arrows
- **Highlight**: Use accent color to highlight merged times

### Status Colors
```
Approved (Regular):  ✓ Green
Approved (Extended): ✓ Green + Gold border
Pending:            ⏳ Amber
Rejected:           ✗ Red
```

## Information Hierarchy

**Priority 1 (Always Show)**
- Request ID
- Date
- Status with extension indicator
- Time (with change indication if extended)

**Priority 2 (Show if Extended)**
- Original time
- Extension request time
- Merged result (highlighted)
- Extension approval timestamp

**Priority 3 (Show on Demand/Detail View)**
- Reason
- Approved by
- Remarks
- Arrival status

## Sorting and Grouping

- **Sort By**: Creation date (newest first)
- **Group By**: 
  1. Extended requests at top
  2. Approved requests
  3. Pending requests
  4. Rejected requests

## Notifications

When extension is approved, show toast notification:
```
✓ Your time extension was approved!
Extended from 10:00-11:00 to 10:00-12:00

Check in by 12:00 hrs
```

When extension is rejected, show alert:
```
✗ Time extension request rejected
Reason: [GSO2 remarks if provided]

You can submit a new extension request if needed.
```

## Testing Checklist for Student History

- [ ] Extended requests show with gold border
- [ ] Time changes display with old → new format
- [ ] Extension details section shows all relevant info
- [ ] Original request time and merged time are clearly different
- [ ] Approved timestamp shows correct date/time
- [ ] GSO2 name appears in approval info
- [ ] Filter by "Extended only" works correctly
- [ ] Multiple extensions can be tracked (if implemented)
- [ ] Works with different time formats (12-hour, 24-hour)
- [ ] Arrival status updates correctly
- [ ] Responsive on mobile and tablet screens
