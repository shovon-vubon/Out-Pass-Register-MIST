# Time Extension Request Feature

## Overview
This feature allows students to extend their existing out-of-mess requests. When a student submits a new request that overlaps or is adjacent to an existing request, the system automatically detects this as a time extension request.

## How It Works

### Student Flow (Frontend - request.js)
1. **Request Detection**: When student submits a new request, the app checks for existing requests on the same date with status 'pending' or 'approved'
2. **Overlap Detection**: If an existing request is found, the app checks if the time ranges overlap or are adjacent
3. **Merge Calculation**: If overlap detected, the app calculates the merged time range (earliest start to latest end)
4. **Visual Confirmation**: Shows the student a visual comparison before submission:
   - Current request time
   - New request time
   - Merged result (if approved)
5. **Request Creation**: Creates a request document with:
   - `type: 'time-extension'`
   - `originalRequestId: <id of original request>`
   - `mergedOutTime` and `mergedExpectedReturn` (the calculated merged times)

### GSO2 Approval Flow (Backend)
The GSO2 approval process should:

1. **Identify Extension Requests**: Check for requests with `type === 'time-extension'`
2. **Display Context**: Show both the original and new time ranges
3. **Approve Flow**:
   - If GSO2 approves the extension:
     - Update the original request with merged times
     - Mark the extension request as 'approved'
     - Update original request status to 'approved'
     - Notify student of successful merge
   - If GSO2 rejects the extension:
     - Mark extension request as 'rejected'
     - Keep original request unchanged
     - Notify student of rejection

## Database Schema

### Request Document Structure
```javascript
{
  // Regular fields
  studentId: string,
  studentName: string,
  serviceNumber: string,
  rank: string,
  dept: string,
  date: string (YYYY-MM-DD),
  outTime: string (HH:MM),
  expectedReturn: string (HH:MM),
  actualReturn: string | null,
  cause: string,
  priority: string ('low', 'medium', 'high'),
  status: string ('pending', 'approved', 'rejected'),
  approvedBy: string | null,
  approvedByName: string | null,
  remarks: string | null,
  arrivalSent: boolean,
  arrivalTime: string | null,
  notifyTokens: string[],
  type: string ('regular' | 'time-extension'), // NEW
  createdAt: timestamp,

  // Time Extension Fields (only for type: 'time-extension')
  originalRequestId: string,           // Reference to the original request ID
  originalOutTime: string,             // Original request departure time
  originalExpectedReturn: string,      // Original request return time
  mergedOutTime: string,               // Calculated earliest departure time
  mergedExpectedReturn: string,        // Calculated latest return time
}
```

## Time Range Logic

### Overlap Detection
Two time ranges are considered overlapping or adjacent if:
- They share any time (overlap)
- They touch at the same time point (adjacent)

Example scenarios:
- 10:00-11:00 + 11:00-12:00 = merge to 10:00-12:00 ✓ (adjacent)
- 10:00-11:00 + 10:30-12:00 = merge to 10:00-12:00 ✓ (overlapping)
- 10:00-11:00 + 11:15-12:00 = DO NOT merge ✗ (gap between them)

### Merge Calculation
- Merged start time = minimum of both start times
- Merged end time = maximum of both end times

## Implementation Checklist

### Frontend (request.js) - ✅ COMPLETE
- [x] Helper functions for time range detection
- [x] Helper function for merging time ranges
- [x] Query existing requests on same date
- [x] Detect time extension during confirmation
- [x] Show visual merge preview in modal
- [x] Create 'time-extension' type requests
- [x] Store original request reference and merged times

### Backend Functions Needed

#### 1. Cloud Function: Approve Time Extension
**Trigger**: When GSO2 approves a time-extension request

```javascript
// functions/index.js - Add this function
exports.approveTimeExtension = functions.firestore
  .document('requests/{requestId}')
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const oldData = change.before.data();

    // Check if this is a time-extension approval
    if (
      newData.type === 'time-extension' &&
      newData.status === 'approved' &&
      oldData.status === 'pending'
    ) {
      const db = admin.firestore();
      
      // Update original request with merged times
      await db.collection('requests')
        .doc(newData.originalRequestId)
        .update({
          outTime: newData.mergedOutTime,
          expectedReturn: newData.mergedExpectedReturn,
          status: 'approved',
          approvedBy: newData.approvedBy,
          approvedByName: newData.approvedByName,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Send notification to student
      const studentQuery = await db.collection('users')
        .doc(newData.studentId)
        .get();
      
      const studentData = studentQuery.data();
      if (studentData && studentData.fcmToken) {
        await admin.messaging().send({
          token: studentData.fcmToken,
          notification: {
            title: 'Time Extension Approved',
            body: `Your request extended to ${newData.mergedOutTime} - ${newData.mergedExpectedReturn}`,
          },
          data: {
            type: 'time_extension_approved',
            requestId: newData.originalRequestId,
          },
        });
      }
    }
  });
```

#### 2. GSO2 Dashboard Updates
The GSO2 view should display extension requests differently:

```javascript
// Show extension requests with visual context:
// "Extension Request: 10:00-11:00 + 11:00-12:00 → 10:00-12:00"
// Include both "Approve" and "Reject" options

// On Approval:
// - Update original request times
// - Mark extension as approved
// - Notify student
```

#### 3. Student History View
Show merged requests clearly:

```javascript
// If request has been merged, show:
// "Original: 10:00-11:00 (Extended to 10:00-12:00) - Approved"
// Or show single merged entry with extension note
```

## Testing Scenarios

### Scenario 1: Adjacent Time Ranges
1. Student submits: 10:00-11:00 (approved)
2. Student submits: 11:00-12:00 (new)
3. System detects extension
4. Shows merge: 10:00-12:00
5. GSO2 approves
6. Original request updated to 10:00-12:00

### Scenario 2: Overlapping Time Ranges
1. Student submits: 10:00-12:00 (approved)
2. Student submits: 11:30-13:00 (new)
3. System detects extension
4. Shows merge: 10:00-13:00
5. GSO2 approves
6. Original request updated to 10:00-13:00

### Scenario 3: Non-overlapping Time Ranges
1. Student submits: 10:00-11:00 (approved)
2. Student submits: 12:00-13:00 (new)
3. System does NOT detect as extension
4. Creates separate request
5. Both requests go to GSO2

### Scenario 4: Rejection
1. Student submits extension request
2. GSO2 rejects extension
3. Original request remains unchanged
4. Student notified of rejection
5. Student can modify and resubmit new extension

## UI/UX Considerations

### Confirmation Modal - Time Extension
- Show "⏱ Time Extension Request" title
- Display existing vs new times with visual comparison
- Show arrow visualization: existing + new → merged
- Highlight merged result prominently in gold
- Change button text to "REQUEST EXTENSION"

### Student Notifications
- Notify when extension is approved (merged time)
- Notify when extension is rejected
- Include merged time in approval message

### GSO2 Interface
- Clearly distinguish time-extension requests from regular requests
- Show visual timeline comparison
- Simple one-click merge approval workflow
- Clear reject with optional feedback

## Error Handling

1. **Query Failure**: If unable to fetch existing requests
   - Log error
   - Treat as regular request (safest fallback)
   - Don't block student submission

2. **Merge Calculation Error**: 
   - Validate time format before calculation
   - Use fallback if calculation fails

3. **Firestore Update Failure**:
   - Retry logic in Cloud Function
   - Log for debugging

## Files Modified

1. **app/(student)/request.js** - Frontend implementation
   - Added helper functions for time detection and merging
   - Added state variables for tracking extensions
   - Modified doSubmit to handle extension requests
   - Updated confirmation modal UI

## Future Enhancements

1. Allow multiple extensions in one session (e.g., 10-11, 11-12, 12-13)
2. Show extension history/timeline in student profile
3. Analytics on extension requests (how often used, approval rate)
4. Auto-suggest nearby existing requests when student inputs time
5. Integration with calendar view for visual overlap detection
