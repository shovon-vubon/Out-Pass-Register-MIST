# Time Extension Feature - Complete Testing Guide

## Overview
This guide provides step-by-step instructions to test the entire time extension feature from student request to GSO2 approval.

## Prerequisites

- Firebase project with Firestore enabled
- Cloud Functions deployed
- Test devices/emulators for student and GSO2 roles
- Test user accounts:
  - 1x Student account
  - 1x GSO2 account
  - Same department

---

## Test Suite 1: Time Overlap Detection ✓

### Test 1.1: Adjacent Time Ranges (Should Merge)
**Scenario**: Student extends request to an adjacent time slot

**Steps**:
1. Student submits request: **Jan 15, 2024 | 10:00-11:00** (Shopping)
2. System marks as approved by GSO2
3. Student submits second request: **Jan 15, 2024 | 11:00-12:00** (Extended stay)
4. Check confirmation modal

**Expected Result**:
- ✓ Modal shows "⏱ Time Extension Request"
- ✓ Visual comparison shows:
  - Current: 10:00-11:00
  - New: 11:00-12:00
  - Merged: 10:00-12:00
- ✓ "REQUEST EXTENSION" button appears

**Verification**:
```
In Firestore, extension request should have:
- type: "time-extension"
- originalRequestId: [ID of first request]
- originalOutTime: "10:00"
- originalExpectedReturn: "11:00"
- outTime: "11:00"
- expectedReturn: "12:00"
- mergedOutTime: "10:00"
- mergedExpectedReturn: "12:00"
```

---

### Test 1.2: Overlapping Time Ranges (Should Merge)
**Scenario**: Student extends with overlapping time range

**Steps**:
1. Student submits request: **Jan 15, 2024 | 10:00-12:00** (Shopping)
2. System marks as approved
3. Student submits second request: **Jan 15, 2024 | 11:30-13:00** (Extended stay)

**Expected Result**:
- ✓ Modal detects time extension
- ✓ Shows merged result: 10:00-13:00
- ✓ Extension request created with correct merge times

**Calculation Verification**:
```
Original: 10:00 (600 min) - 12:00 (720 min)
New:      11:30 (690 min) - 13:00 (780 min)
Merged:   10:00 (min of 600,690) - 13:00 (max of 720,780) ✓
```

---

### Test 1.3: Non-Overlapping Time Ranges (Should NOT Merge)
**Scenario**: Student requests different time slot (gap exists)

**Steps**:
1. Student submits request: **Jan 15, 2024 | 10:00-11:00** (Shopping)
2. System marks as approved
3. Student submits second request: **Jan 15, 2024 | 12:00-13:00** (New request)

**Expected Result**:
- ✗ No extension detection
- ✗ Modal shows "Confirm Request" (regular, not extension)
- ✗ Regular request created (not time-extension)

**Verification**:
```
No extension request created
Request created with:
- type: "regular" (or no type field)
- status: "pending"
- No originalRequestId field
```

---

### Test 1.4: Same Time Range (Exact Duplicate)
**Scenario**: Student submits exact same time range twice

**Steps**:
1. Student submits request: **Jan 15, 2024 | 10:00-11:00** (Shopping)
2. System marks as approved
3. Student submits second request: **Jan 15, 2024 | 10:00-11:00** (Same time)

**Expected Result**:
- ✓ Extension detected (exact overlap)
- ✓ Merged time: 10:00-11:00 (same as original)
- ✓ Extension request created

**Verification**:
```
mergedOutTime: "10:00"
mergedExpectedReturn: "11:00"
(Merged result is same as original)
```

---

## Test Suite 2: Request Submission Flow ✓

### Test 2.1: Regular Request Creation
**Scenario**: Student submits request without existing request

**Steps**:
1. Clear all requests for student
2. Student fills form:
   - Date: Jan 15, 2024
   - Departure: 14:00
   - Return: 15:00
   - Reason: Shopping
3. Click "REVIEW & SUBMIT"
4. Click "CONFIRM & SUBMIT"

**Expected Result**:
- ✓ Request created in Firestore
- ✓ No extension detection (no existing request)
- ✓ Modal shows regular confirmation
- ✓ Notification sent to GSO2
- ✓ Redirects to history after 1.5 seconds

**Database Check**:
```
Collection: requests
Document fields:
- studentId: [student UID]
- studentName: [correct name]
- serviceNumber: [correct number]
- date: "2024-01-15"
- outTime: "14:00"
- expectedReturn: "15:00"
- cause: "Shopping"
- type: "regular"
- status: "pending"
- priority: "low"
- createdAt: [timestamp]
```

---

### Test 2.2: Time Extension Request Creation
**Scenario**: Student submits overlapping request

**Steps**:
1. Existing request: Jan 15 | 10:00-11:00 (approved)
2. Student submits: Jan 15 | 11:00-12:00 (Shopping)
3. Confirmation modal shows extension UI
4. Click "REQUEST EXTENSION"

**Expected Result**:
- ✓ Extension request created
- ✓ Contains all original request fields
- ✓ Contains extension-specific fields:
  - type: "time-extension"
  - originalRequestId: [reference]
  - mergedOutTime/mergedExpectedReturn

**Database Check**:
```
Extension request should have:
- type: "time-extension"
- originalRequestId: [first request ID]
- mergedOutTime: "10:00"
- mergedExpectedReturn: "12:00"
- status: "pending"
- approvedBy: null (awaiting approval)
```

---

## Test Suite 3: GSO2 Approval Workflow

### Test 3.1: Approve Time Extension
**Scenario**: GSO2 approves extension request, requests should merge

**Steps**:
1. Extension request pending in GSO2 records
2. GSO2 views time extension card
3. GSO2 clicks "✓ APPROVE & MERGE"
4. System updates status to "approved"

**Expected Result**:
- ✓ Extension request marked "approved"
- ✓ Cloud Function triggers automatically
- ✓ Original request updated with merged times:
  - outTime: "10:00" (was 10:00)
  - expectedReturn: "12:00" (was 11:00)
- ✓ Student receives notification: "✓ Time Extension Approved"

**Database Verification**:
```
Original Request After Merge:
- outTime: "10:00"
- expectedReturn: "12:00" ← UPDATED
- status: "approved"
- updatedAt: [new timestamp]

Extension Request:
- status: "approved"
- updatedAt: [timestamp]
```

**Notification Verification**:
```
Student receives:
- Title: "✓ Time Extension Approved"
- Body: "Your request has been extended from 10:00-11:00 to 10:00-12:00"
- Data: {type: "time_extension_approved", requestId: [original]}
```

---

### Test 3.2: Reject Time Extension
**Scenario**: GSO2 rejects extension request

**Steps**:
1. Extension request pending in GSO2 records
2. GSO2 clicks "✗ REJECT"
3. Remarks modal appears (optional)
4. GSO2 enters remark: "Excessive extension time"
5. Click "REJECT" in modal

**Expected Result**:
- ✓ Extension request marked "rejected"
- ✓ Extension remarks saved: "Excessive extension time"
- ✓ Original request remains unchanged:
  - Still shows: 10:00-11:00
  - Status stays: "approved"
- ✓ Student receives notification: "✗ Time Extension Rejected"

**Database Verification**:
```
Extension Request:
- status: "rejected"
- remarks: "Excessive extension time"
- updatedAt: [timestamp]

Original Request (Unchanged):
- outTime: "10:00" (unchanged)
- expectedReturn: "11:00" (unchanged)
- status: "approved" (unchanged)
```

**Notification Verification**:
```
Student receives:
- Title: "✗ Time Extension Rejected"
- Body: "Your extension request for 11:00-12:00 has been rejected. Remarks: Excessive extension time"
- Data: {type: "time_extension_rejected"}
```

---

## Test Suite 4: Student History Display

### Test 4.1: Show Regular Request in History
**Scenario**: Student views regular (non-extended) request

**Expected Display**:
```
REQ-2024-123456
📅 2024-01-15
✓ APPROVED

Time Out: 10:00 hrs
Expected Return: 11:00 hrs

Reason: Shopping

Approval Information
├─ Status: Approved
├─ Approved By: Sgt. Kumar (GSO2)
└─ Approved: Jan 15, 2024 14:30

Arrival Status
└─ ⏳ Remember to check in by 11:00 hrs
```

---

### Test 4.2: Show Extended Request in History
**Scenario**: Student views merged request after extension approved

**Expected Display**:
```
REQ-2024-123456
📅 2024-01-15
✓ APPROVED (EXT)  [Gold border]

DEPARTURE: 10:00 → 12:00  [Original strikethrough, new in gold]
RETURN: 11:00 → 12:00     [Original strikethrough, new in gold]

Reason: Shopping

⏱ EXTENSION DETAILS
├─ Original Request: 10:00 - 11:00
├─ Extension Request: 11:00 - 12:00
├─ Merged Result: 10:00 - 12:00 [Highlighted in gold]
└─ Approved: Jan 15, 2024 15:45 by Sgt. Kumar

Approval Information
├─ Status: Approved (Extended)
├─ Approved By: Sgt. Kumar
└─ Remarks: Time extension approved and merged

Arrival Status
└─ ⏳ Remember to check in by 12:00 hrs
```

---

## Test Suite 5: Edge Cases & Error Handling

### Test 5.1: Pending Original Request Extension
**Scenario**: Extend a request that's still pending (not approved)

**Steps**:
1. Student submits request: Jan 15 | 10:00-11:00
2. Request status: "pending" (not yet approved)
3. Student immediately submits: Jan 15 | 11:00-12:00

**Expected Result**:
- ✓ Extension detected (status includes 'pending')
- ✓ Extension request created referencing pending request
- ✓ Both requests go to GSO2
- ✓ GSO2 can approve original, then extension
- ✓ Final merge shows 10:00-12:00

---

### Test 5.2: Multiple Extensions (Chain)
**Scenario**: Student extends multiple times

**Steps**:
1. Request 1 (approved): 10:00-11:00
2. Request 2 (approved): 11:00-12:00 → merged to 10:00-12:00
3. Request 3 (new): 12:00-13:00 → references Request 1 or Request 2?

**Current Implementation Behavior**:
- Query finds most recent approved request (Request 1)
- Creates extension referencing Request 1
- Calculates merge: 10:00-13:00

**Expected Result**:
- ✓ Creates extension request
- ✓ References original Request 1
- ✓ Final merge: 10:00-13:00

**Future Enhancement**:
- May need logic to follow extension chain

---

### Test 5.3: Network Failure During Submission
**Scenario**: Network error after clicking "CONFIRM & SUBMIT"

**Expected Result**:
- ✓ Error message shown: "Failed to submit. Please try again."
- ✓ Modal remains open
- ✓ User can retry
- ✓ No duplicate requests created

---

### Test 5.4: Curfew Time Extension
**Scenario**: Extend request past 22:00 (curfew)

**Steps**:
1. Request 1 (approved): 21:00-22:00
2. Request 2: 22:00-23:00
3. Check warning about curfew return

**Expected Result**:
- ✓ First request already past curfew check
- ✓ Merged time checked: 21:00-23:00
- ✓ Warning shown: "Return after 2200 hrs — GSO-2 approval required"
- ✓ Extension created normally

---

### Test 5.5: Different Departments
**Scenario**: Ensure extension requests respect department separation

**Steps**:
1. Student in Dept A submits request
2. Different department GSO2 views records
3. Extension request should NOT appear

**Expected Result**:
- ✓ Extension request only visible to correct dept GSO2
- ✓ Query filters by dept correctly
- ✓ No cross-department visibility

---

## Test Suite 6: Notifications

### Test 6.1: GSO2 Push Notification on New Extension
**Scenario**: Student submits time extension, GSO2 receives notification

**Expected**:
- ✓ Notification received on GSO2 device
- ✓ Title contains "Extension" or "⏱"
- ✓ Can navigate to request on tap

**Testing**:
1. Student submits extension
2. Monitor GSO2 device
3. Check notification received within 5 seconds
4. Tap notification
5. Verify navigates to correct request

---

### Test 6.2: Student Notification on Approval
**Scenario**: GSO2 approves extension, student receives notification

**Expected**:
- ✓ Notification: "✓ Time Extension Approved"
- ✓ Shows merged time in body
- ✓ Tap navigates to request history

---

### Test 6.3: Student Notification on Rejection
**Scenario**: GSO2 rejects extension with remarks

**Expected**:
- ✓ Notification: "✗ Time Extension Rejected"
- ✓ Shows reason if provided
- ✓ Can navigate to see rejection details

---

## Test Suite 7: Data Integrity

### Test 7.1: Verify Firestore Schema Compliance
**Steps**:
1. Submit regular request
2. Submit extension request
3. Check Firestore documents

**Checklist**:
- [ ] All required fields present
- [ ] No extra/unexpected fields
- [ ] Timestamps in correct format
- [ ] Arrays properly structured
- [ ] References valid

---

### Test 7.2: Verify No Data Loss on Merge
**Steps**:
1. Create request with specific details
2. Create extension
3. Approve extension
4. Query original request

**Verify**:
- [ ] Student info unchanged
- [ ] Department unchanged
- [ ] Priority preserved
- [ ] Original timestamps preserved (or noted)
- [ ] Request ID unchanged

---

### Test 7.3: Verify Audit Trail
**Steps**:
1. Create request → updatedAt: [time1]
2. Approve extension → original updatedAt: [time2]
3. View request history

**Expected**:
- [ ] Can see when original was created
- [ ] Can see when it was extended
- [ ] Can track approval chain

---

## Test Suite 8: Performance

### Test 8.1: Query Performance
**Steps**:
1. Create 100 requests in student's account
2. Student submits new request
3. Measure time to check for extensions

**Target**: < 500ms

---

### Test 8.2: Merge Calculation Performance
**Steps**:
1. Call mergeTimeRanges 1000 times
2. Measure execution time

**Target**: < 100ms for 1000 calculations

---

## Regression Testing

### After Each Approval
- [ ] Test regular request still works
- [ ] Test different time ranges
- [ ] Test notifications
- [ ] Test history display

### After Each Rejection
- [ ] Original request still intact
- [ ] Can submit new extension
- [ ] Student notified
- [ ] History shows rejection

---

## Test Coverage Checklist

### Frontend (request.js)
- [x] timeToMinutes() works correctly
- [x] isTimeRangeOverlapOrAdjacent() detects overlaps
- [x] mergeTimeRanges() calculates correctly
- [x] findExistingRequest() queries correctly
- [x] Extension modal shows visuals
- [x] Regular/extension submission flow
- [ ] Error handling for edge cases

### Backend (functions/index.js)
- [x] approveTimeExtension() trigger fires
- [x] Original request updated on approval
- [x] Notification sent to student
- [x] rejectTimeExtension() trigger fires
- [x] Original unchanged on rejection
- [ ] Error logging and monitoring

### GSO2 Interface (TO DO)
- [ ] TimeExtensionRequestCard displays correctly
- [ ] Approve button works
- [ ] Reject button works
- [ ] Remarks modal functions
- [ ] Filtering works

### Student History (TO DO)
- [ ] Extended requests display correctly
- [ ] Time changes shown
- [ ] Extension details visible
- [ ] Filtering works
- [ ] Responsive design

---

## Success Criteria

Feature is complete when:
1. ✓ Student can submit time extension for adjacent/overlapping times
2. ✓ System detects overlap and creates extension request
3. ✓ GSO2 can view and approve extension
4. ✓ On approval, original request time is updated
5. ✓ On rejection, original request unchanged
6. ✓ Student receives notifications for approval/rejection
7. ✓ Student history clearly shows merged times
8. ✓ No data loss in merge process
9. ✓ Handles all edge cases gracefully
10. ✓ Proper error messages on failures

---

## Known Test Issues

- [To be updated as issues found during testing]

---

## Approval Sign-Off

- [ ] QA Lead: Feature tested and approved
- [ ] Product Owner: Feature meets requirements
- [ ] Engineering Lead: Code review complete
- [ ] Deployment Ready: All tests passing

---

**Last Updated**: January 2025
**Test Status**: Ready for execution
