# Request Timeout Feature Documentation

## Overview

The **Request Timeout Feature** automatically marks pending out-of-mess requests as "timeout" (or "TIME OVER") when GSO2 fails to approve or reject them by the expected return time. This ensures that abandoned requests don't remain in "pending" state indefinitely.

**Status Flow**:
```
Student Request Submitted
        ↓
    pending
    ↙   ↓   ↘
approved  rejected  [time passes → no response]
            ↓
        timeout ⏱
```

---

## Feature Details

### When a Request Times Out

A request automatically transitions to **"timeout"** status when:

1. **Status is "pending"** - Request has not been approved or rejected
2. **Current time ≥ expectedReturn** - The return-by time has passed
3. **No approval/rejection was given** - GSO2 did not take action

**Example**:
- Student requests: Out at 10:00, Return by 11:00
- At 11:00 and beyond, if GSO2 hasn't approved/rejected
- System automatically marks as "timeout"

### Automatic Detection

The system uses two parallel mechanisms for timeout detection:

#### 1. **Scheduled Cloud Function** (Primary)
- Runs every **5 minutes** via Cloud Scheduler
- Scans all pending requests
- Marks expired ones as "timeout"
- Sends notifications to affected students

```javascript
exports.markRequestsAsTimeout = functions.pubsub
    .schedule("*/5 * * * *") // Every 5 minutes
    .timeZone("Asia/Kolkata")
    .onRun(async (context) => {
      // Query pending requests and check if time has passed
      // Update status to "timeout"
      // Send notifications
    });
```

#### 2. **Real-time Check** (Secondary)
- Triggered whenever a request document is read
- Immediate detection if someone views an expired request
- Ensures no stale "pending" status visible to users

```javascript
exports.checkAndMarkRequestTimeout = functions.firestore
    .document("requests/{requestId}")
    .onRead(async (snap, context) => {
      // Check if this request has expired
      // If yes, mark as timeout immediately
    });
```

### User Notifications

When a request times out, the student receives a notification:

**Notification Details**:
- **Title**: ⏱ Request Timeout
- **Body**: Your out-of-mess request for [DATE] ([TIME_RANGE]) has expired and moved to "Time Over" section.
- **Data**: Request ID, date for deep linking

**Notification Delivery**: Via Firebase Cloud Messaging (FCM) to student's registered device

---

## Firestore Schema Changes

### Request Document - New Fields

```javascript
{
  // Existing fields...
  studentId, studentName, date, outTime, expectedReturn, cause, status...
  
  // New fields for timeout:
  status: "timeout",                              // Status changed from "pending"
  timedOutAt: Timestamp.now(),                    // When timeout was marked
  remarks: "Request expired - No approval/rejection by return time"  // Auto-populated if empty
}
```

### Fields Reference

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Set to `"timeout"` when expired |
| `timedOutAt` | Timestamp | Server timestamp when timeout was detected |
| `remarks` | string | Explanation of timeout (auto-set if blank) |

---

## UI Changes

### 1. GSO2 Records View (`app/(gso2)/records.js`)

**New Section**: ⏱ TIME OVER / EXPIRED

The records view now displays requests in two sections:

```
┌─────────────────────────────────┐
│   📋 PENDING & PROCESSED        │
│   (Approved, Rejected, etc.)    │
├─────────────────────────────────┤
│   ⏱ TIME OVER / EXPIRED         │
│   (Timeout requests)            │
└─────────────────────────────────┘
```

**Features**:
- Timeout section appears with red styling (#ff6b6b)
- Shows count of timed-out requests
- Each timeout request card has:
  - Red left border (4px)
  - Light red background
  - **Expected Return Time** in bold red
  - ⚠️ Warning message: "GSO2 did not respond by [TIME] hrs"

**Filtering**: Timeout requests are separated from regular requests in the filtered list

**Styling**:
```javascript
// Timeout section
borderTopWidth: 2, borderTopColor: '#ff6b6b', paddingTop: 15

// Timeout card
borderLeftWidth: 4, borderLeftColor: '#ff6b6b', backgroundColor: '#fff9f9'

// Expected return time
color: '#ff6b6b', fontWeight: 'bold'

// Timeout message
color: '#ff6b6b', fontStyle: 'italic'
```

### 2. Student History View (`app/(student)/history.js`)

**New Section**: ⏱ Time Over (Expired)

Students see their timed-out requests in a dedicated section:

```
┌─────────────────────────────────┐
│   📋 My Requests                │
│   (Pending, Approved, etc.)     │
├─────────────────────────────────┤
│   ⏱ Time Over (Expired)         │
│   (Timeout requests)            │
└─────────────────────────────────┘
```

**Features**:
- Separate from regular requests
- Shows count of expired requests
- Each timeout card displays:
  - Red left border (4px)
  - Light red background
  - **Expected return time** in bold red
  - ⚠️ Timeout message box explaining the expiration
  - Original remarks (if any)

**Message to Student**:
```
⚠️ Timeout: GSO2 did not approve/reject by [TIME] hrs. 
This request has expired.
```

**Styling**:
```javascript
// Timeout section
borderTopWidth: 2, borderTopColor: '#ff6b6b', paddingTop: 16

// Timeout card
borderLeftWidth: 4, borderLeftColor: '#ff6b6b', backgroundColor: '#fff9f9'

// Timeout message box
backgroundColor: '#ffe5e5', borderLeftColor: '#ff6b6b'

// Text color
color: '#ff6b6b', '#cc0000'
```

---

## Implementation Flow

### Backend Flow

```
Every 5 minutes:
  1. Cloud Scheduler triggers markRequestsAsTimeout()
  2. Query: db.collection("requests").where("status", "==", "pending")
  3. For each request:
     a. Parse expectedReturn time (HH:MM format)
     b. Build expectedDateTime (date + time)
     c. Compare: now > expectedDateTime?
     d. If YES:
        - batch.update(doc, { status: "timeout", timedOutAt, remarks })
        - Send FCM notification to student
  4. Commit batch updates
  5. Log: "Marked X requests as timeout"

When a request is read:
  1. Cloud Function: checkAndMarkRequestTimeout triggered
  2. Check: request.status === "pending"?
  3. Parse expectedReturn time
  4. If now > expectedDateTime:
     - Update status to "timeout"
     - Send notification to student
     - Log the change
```

### Frontend Flow

```
GSO2 Records View:
  1. Fetch all requests from Firestore
  2. Apply filters (date range, search, etc.)
  3. Separate into:
     - regularRequests (status !== "timeout")
     - timeoutRequests (status === "timeout")
  4. Render both sections

Student History View:
  1. Fetch student's requests
  2. Separate into:
     - regularRequests (status !== "timeout")
     - timeoutRequests (status === "timeout")
  3. Display regular requests first
  4. Display timeout requests in red section below
```

---

## Time Format

The system uses **24-hour HH:MM format**:

Examples:
- 08:00 (8 AM)
- 11:30 (11:30 AM)
- 14:45 (2:45 PM)
- 18:00 (6 PM)

**Conversion in Cloud Function**:
```javascript
const [expHour, expMin] = "14:30".split(":").map(Number); // [14, 30]
const expectedDateTime = new Date(
  requestDate.getFullYear(),
  requestDate.getMonth(),
  requestDate.getDate(),
  expHour,     // 14 hours
  expMin       // 30 minutes
);
```

---

## Edge Cases & Handling

### 1. Request with No expectedReturn Value
**Handling**: Default to "00:00" (midnight)
```javascript
const [expHour, expMin] = (request.expectedReturn || "00:00").split(":").map(Number);
```

### 2. Timezone Considerations
**Current**: Cloud Function uses **Asia/Kolkata** timezone
```javascript
.timeZone("Asia/Kolkata")
```

**Device Timezone**: Device shows times in local timezone (handled by Firebase/device)

### 3. Request Created After Timeout Occurred
**Not Possible**: Requests are created with future times only

### 4. Multiple Timeout Detections
**Handling**: Both mechanisms (scheduled + real-time) have idempotency:
- Checking `status === "pending"` before marking as timeout
- If already marked as "timeout", won't trigger again

### 5. Network Latency
**Scheduled Function**: Runs every 5 minutes, ensuring eventual consistency
**Real-time Check**: Immediate if request is accessed by user

---

## Integration with Other Features

### Time Extension Feature
- **Extension requests** (type: "time-extension") can also timeout
- If extension request remains pending past expectedReturn, it times out
- Original request remains unchanged (separate from extension timeout)

### Request Approval/Rejection
- **Once approved/rejected**, status changes from "pending"
- Timeout detection ignores approved/rejected requests
- Only pending requests can timeout

### Student Arrival Tracking
- **Timeout status** doesn't prevent arrival tracking
- Student can still send arrival notification even after timeout
- Timeline shown in both GSO2 and student views

---

## Testing

### Test Case 1: Timeout Detection
**Objective**: Verify request automatically times out after expectedReturn time

**Steps**:
1. Create request with past expectedReturn time
2. Wait for scheduled function to run (or manually trigger)
3. Verify status changed to "timeout"
4. Check timedOutAt timestamp is set
5. Verify notification sent to student FCM token

**Expected Result**: Request status = "timeout", timedOutAt is set

### Test Case 2: GSO2 Views Timeout Section
**Objective**: Verify GSO2 sees "TIME OVER" section with timed-out requests

**Steps**:
1. Login as GSO2
2. Navigate to Records tab
3. Check if "⏱ TIME OVER / EXPIRED" section appears
4. Verify count matches timeout requests
5. Click on timeout request to view details
6. Verify red styling applied

**Expected Result**: Timeout section visible with correct styling and data

### Test Case 3: Student Views Timeout History
**Objective**: Verify student sees "Time Over" section in history

**Steps**:
1. Login as student with timed-out request
2. Navigate to History tab
3. Check if "⏱ Time Over (Expired)" section appears
4. Verify timeout request displays with warning message
5. Verify red border and styling
6. Read timeout explanation message

**Expected Result**: Timeout section visible with appropriate messaging

### Test Case 4: Timeout Notification
**Objective**: Verify student receives FCM notification on timeout

**Steps**:
1. Register student FCM token
2. Create request with past expectedReturn
3. Trigger timeout detection
4. Check device notifications
5. Verify notification content

**Expected Result**: Notification received with correct title and message

### Test Case 5: No Timeout for Non-Pending Requests
**Objective**: Verify approved/rejected requests don't timeout

**Steps**:
1. Approve a request
2. Wait past expectedReturn time
3. Check request status
4. Verify status remains "approved"
5. Verify NOT marked as "timeout"

**Expected Result**: Approved request stays approved, not affected by timeout

---

## Deployment Checklist

### Backend
- [ ] Deploy updated `functions/index.js` with timeout functions
- [ ] Test Cloud Function locally: `firebase emulators:start`
- [ ] Deploy to Firebase: `firebase deploy --only functions`
- [ ] Verify Cloud Scheduler trigger is active in Google Cloud Console
- [ ] Test notification sending with test FCM token

### Frontend
- [ ] Update `app/(gso2)/records.js` with timeout section
- [ ] Update `app/(student)/history.js` with timeout section
- [ ] Build and test on Android: `npx cap run android`
- [ ] Build and test on Web: `npm run build:web`
- [ ] Verify styling matches design (red borders, background colors)

### Database
- [ ] No schema changes needed (optional fields added)
- [ ] Firestore indexes: None required (queries already indexed)

### Monitoring
- [ ] Check Cloud Function logs in Firebase Console
- [ ] Monitor for timeout detection frequency
- [ ] Track notification delivery in Firebase Console
- [ ] Monitor for errors in Cloud Function execution

---

## Configuration

### Cloud Scheduler Setup (One-time)

**If manually creating the trigger** (usually Firebase handles this):

1. Go to Google Cloud Console
2. Navigate to Cloud Scheduler
3. Create new job:
   - **Name**: mark-requests-as-timeout
   - **Frequency**: `*/5 * * * *` (every 5 minutes)
   - **Timezone**: Asia/Kolkata
   - **Execution**: Pub/Sub
   - **Topic**: firebase-schedule-markRequestsAsTimeout

### Firebase Configuration

Ensure these are enabled in Firebase Console:
- ✅ Cloud Firestore (database)
- ✅ Cloud Functions
- ✅ Cloud Pub/Sub (for scheduler)
- ✅ Cloud Logging (for monitoring)
- ✅ Firebase Cloud Messaging (for notifications)

### Timezone

Current timezone: **Asia/Kolkata (IST)** - UTC+5:30

To change:
```javascript
.timeZone("Your/Timezone")  // Update in markRequestsAsTimeout function
```

---

## Troubleshooting

### Issue: Requests Not Timing Out

**Possible Causes**:
1. Cloud Function not deployed
2. Cloud Scheduler job not active
3. Request's expectedReturn time is in future
4. Request status is not "pending"

**Solutions**:
- Check Firebase Cloud Function logs
- Verify Cloud Scheduler job is running
- Test with a request that has past expectedReturn time
- Manually trigger function: `firebase functions:shell` → `markRequestsAsTimeout()`

### Issue: Notifications Not Received

**Possible Causes**:
1. FCM token not registered
2. Device offline when notification sent
3. Notification permission denied on device

**Solutions**:
- Verify student FCM token in database
- Check Cloud Messaging in Firebase Console
- Test notification manually
- Check device notification settings

### Issue: Timeout Requests Still Show as Pending

**Possible Causes**:
1. Real-time Firestore listener cache
2. Cloud Function error (check logs)
3. Incorrect time comparison logic

**Solutions**:
- Force refresh app (pull-down)
- Check Cloud Function execution logs
- Verify date/time format is correct
- Test with browser console in web version

### Issue: Timeout Section Not Appearing in UI

**Possible Causes**:
1. timeoutRequests array is empty
2. Styling not applied
3. Code not deployed

**Solutions**:
- Rebuild app: `npm run build:web` or `npx cap run android`
- Check if timeout requests exist in Firestore
- Verify styling in source code
- Check for JavaScript errors in console

---

## Future Enhancements

### Potential Improvements

1. **Manual Re-Request**: Allow students to resubmit after timeout
2. **Timeout Duration Customization**: Different timeouts by department
3. **Bulk Timeout Management**: GSO2 can mark multiple as timeout
4. **Timeout Reason Categories**: Different messages for different situations
5. **Reminders**: Send warnings before timeout occurs
6. **Analytics**: Track timeout frequency and trends
7. **Grace Period**: Optional buffer after expectedReturn before marking timeout

### Suggested Implementation

```javascript
// Example: Add reminder notification 5 minutes before timeout
function sendTimeoutReminder(request) {
  const reminderTime = new Date(expectedDateTime.getTime() - 5 * 60 * 1000);
  // Schedule notification for reminderTime
}

// Example: Configurable timeout grace period
const GRACE_PERIOD_MINUTES = 5;
const timeoutThreshold = expectedDateTime + GRACE_PERIOD_MINUTES * 60 * 1000;
```

---

## Related Documentation

- **Time Extension Feature**: `TIME_EXTENSION_README.md`
- **Cloud Functions**: `functions/index.js`
- **GSO2 Records**: `app/(gso2)/records.js`
- **Student History**: `app/(student)/history.js`
- **Request Schema**: See Firestore Database Rules

---

## Support & Questions

For issues or questions about the timeout feature:
1. Check the Troubleshooting section above
2. Review Cloud Function logs in Firebase Console
3. Check device console for JavaScript errors
4. Verify Firestore database has correct data

---

**Last Updated**: 2025
**Version**: 1.0
**Status**: Production Ready ✅
