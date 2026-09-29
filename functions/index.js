/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const functions = require("firebase-functions");
const {admin} = require("./config/firebase");
const {sendPushNotification} = require("./services/notificationService");

setGlobalOptions({maxInstances: 10});

const HIGH_PRIORITY_CAUSES = ["Medical Emergency", "Blood Donation"];
const MEDIUM_PRIORITY_CAUSES = ["Family Meeting"];
const HIGH_PRIORITY_KEYWORDS = /\b(emg|emergency)\b/i;
const MEDIUM_PRIORITY_KEYWORDS = /\b(mdm|medium)\b/i;

/**
 * Derives request priority from the student's stated reason.
 *
 * @param {string} cause The reason text stored on the request.
 * @return {string} One of "high", "medium", "low".
 */
function getPriority(cause) {
  if (HIGH_PRIORITY_CAUSES.includes(cause)) return "high";
  if (MEDIUM_PRIORITY_CAUSES.includes(cause)) return "medium";
  if (HIGH_PRIORITY_KEYWORDS.test(cause)) return "high";
  if (MEDIUM_PRIORITY_KEYWORDS.test(cause)) return "medium";
  return "low";
}

const PRIORITY_LABELS = {
  high: "🔴 HIGH PRIORITY",
  medium: "🟡 MEDIUM PRIORITY",
  low: "",
};


exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be signed in.",
    );
  }

  const callerUid = context.auth.uid;
  const targetUid = data.targetUid;

  // 1. Fetch the roles of both the caller and the target user
  const [callerSnap, targetSnap] = await Promise.all([
    admin.firestore().collection("users").doc(callerUid).get(),
    admin.firestore().collection("users").doc(targetUid).get(),
  ]);

  const callerRole = callerSnap.exists ? callerSnap.data().role : null;
  const targetRole = targetSnap.exists ? targetSnap.data().role : null;

  // 2. Rule: Only GSO-2 or Admins are allowed to initiate deletions
  if (callerRole !== "gso2" && callerRole !== "admin") {
    throw new functions.https.HttpsError(
        "permission-denied",
        "You do not have permission to delete users.",
    );
  }

  // 3. Rule: Admins cannot delete a GSO-2 user
  if (targetRole === "gso2" && callerRole !== "gso2") {
    throw new functions.https.HttpsError(
        "permission-denied",
        "Admins are not permitted to delete GSO-2 users.",
    );
  }

  // 4. Perform the deletion
  await admin.auth().deleteUser(targetUid);
  await admin.firestore().collection("users").doc(targetUid).delete();

  return { success: true, message: `Successfully deleted user ${targetUid}` };
});

/**
 * Handles time-extension request approval.
 * When a time-extension request is approved, this function:
 * 1. Updates the original request with merged times
 * 2. Marks the extension request as approved
 * 3. Notifies the student of the successful merge
 */
exports.approveTimeExtension = functions.firestore
    .document("requests/{requestId}")
    .onUpdate(async (change, context) => {
      const newData = change.after.data();
      const oldData = change.before.data();
      const db = admin.firestore();

      try {
        // Check if this is a time-extension approval
        if (
            newData.type === "time-extension" &&
            newData.status === "approved" &&
            oldData.status !== "approved"
        ) {
          // Update original request with merged times
          const originalRequestRef = db.collection("requests")
              .doc(newData.originalRequestId);

          await originalRequestRef.update({
            outTime: newData.mergedOutTime,
            expectedReturn: newData.mergedExpectedReturn,
            status: "approved",
            approvedBy: newData.approvedBy || null,
            approvedByName: newData.approvedByName || null,
            remarks: newData.remarks || "Extended time approved",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Send notification to student about merged request
          const studentRef = db.collection("users").doc(newData.studentId);
          const studentSnap = await studentRef.get();

          if (studentSnap.exists) {
            const studentData = studentSnap.data();
            if (studentData.fcmToken) {
              await sendPushNotification({
                token: studentData.fcmToken,
                title: "✓ Time Extension Approved",
                body: `Your request has been extended from ${newData.originalOutTime}-${newData.originalExpectedReturn} to ${newData.mergedOutTime}-${newData.mergedExpectedReturn}`,
                data: {
                  type: "time_extension_approved",
                  requestId: newData.originalRequestId,
                  mergedOutTime: newData.mergedOutTime,
                  mergedExpectedReturn: newData.mergedExpectedReturn,
                },
              });
            }
          }

          functions.logger.info(
              "Time extension approved and original request merged",
              {
                extensionRequestId: context.params.requestId,
                originalRequestId: newData.originalRequestId,
                mergedTime: `${newData.mergedOutTime}-${newData.mergedExpectedReturn}`,
              },
          );
        }
      } catch (error) {
        functions.logger.error("Error processing time extension approval", {
          requestId: context.params.requestId,
          error: error.message,
        });
      }

      return null;
    });

/**
 * Handles time-extension request rejection.
 * When a time-extension request is rejected, notifies the student.
 */
exports.rejectTimeExtension = functions.firestore
    .document("requests/{requestId}")
    .onUpdate(async (change, context) => {
      const newData = change.after.data();
      const oldData = change.before.data();
      const db = admin.firestore();

      try {
        // Check if this is a time-extension rejection
        if (
            newData.type === "time-extension" &&
            newData.status === "rejected" &&
            oldData.status !== "rejected"
        ) {
          // Send notification to student about rejection
          const studentRef = db.collection("users").doc(newData.studentId);
          const studentSnap = await studentRef.get();

          if (studentSnap.exists) {
            const studentData = studentSnap.data();
            if (studentData.fcmToken) {
              await sendPushNotification({
                token: studentData.fcmToken,
                title: "✗ Time Extension Rejected",
                body: `Your extension request for ${newData.outTime}-${newData.returnTime} has been rejected.${newData.remarks ? " Remarks: " + newData.remarks : ""}`,
                data: {
                  type: "time_extension_rejected",
                  requestId: context.params.requestId,
                  originalRequestId: newData.originalRequestId,
                },
              });
            }
          }

          functions.logger.info(
              "Time extension rejected",
              {
                extensionRequestId: context.params.requestId,
                originalRequestId: newData.originalRequestId,
              },
          );
        }
      } catch (error) {
        functions.logger.error("Error processing time extension rejection", {
          requestId: context.params.requestId,
          error: error.message,
        });
      }

      return null;
    });

/**
 * Scheduled Cloud Function to mark pending requests as "timeout"
 * if the expected return time has passed and no approval/rejection was given.
 *
 * This function runs every 5 minutes (configured in Cloud Scheduler).
 * When a request's expectedReturn time passes and status is still "pending",
 * the request is marked as "timeout" and student is notified.
 */
exports.markRequestsAsTimeout = functions.pubsub
    .schedule("*/5 * * * *") // Every 5 minutes
    .timeZone("Asia/Kolkata")
    .onRun(async (context) => {
      const db = admin.firestore();
      const now = new Date();

      try {
        // Query all pending requests
        const pendingRequestsSnap = await db.collection("requests")
            .where("status", "==", "pending")
            .get();

        const batch = db.batch();
        let timeoutCount = 0;

        for (const doc of pendingRequestsSnap.docs) {
          const request = doc.data();

          // Convert expectedReturn time to a comparable format
          // expectedReturn is in HH:MM format
          const [expHour, expMin] = (request.expectedReturn || "00:00")
              .split(":")
              .map(Number);
          const requestDate = new Date(request.date); // Assuming date is YYYY-MM-DD
          const expectedDateTime = new Date(
              requestDate.getFullYear(),
              requestDate.getMonth(),
              requestDate.getDate(),
              expHour,
              expMin,
          );

          // Check if current time has passed the expected return time
          if (now > expectedDateTime && request.status === "pending") {
            // Mark as timeout
            batch.update(doc.ref, {
              status: "timeout",
              timedOutAt: admin.firestore.FieldValue.serverTimestamp(),
              remarks: request.remarks || "Request expired - No approval/rejection by return time",
            });

            timeoutCount++;

            // Send notification to student
            const studentRef = db.collection("users").doc(request.studentId);
            const studentSnap = await studentRef.get();

            if (studentSnap.exists) {
              const studentData = studentSnap.data();
              if (studentData.fcmToken) {
                await sendPushNotification({
                  token: studentData.fcmToken,
                  title: "⏱ Request Timeout",
                  body: `Your out-of-mess request for ${request.date} (${request.outTime}-${request.expectedReturn}) has expired and moved to "Time Over" section.`,
                  data: {
                    type: "request_timeout",
                    requestId: doc.id,
                    date: request.date,
                  },
                });
              }
            }
          }
        }

        // Commit all updates at once
        if (timeoutCount > 0) {
          await batch.commit();
          functions.logger.info(
              "Marked requests as timeout",
              {
                count: timeoutCount,
                timestamp: new Date().toISOString(),
              },
          );
        }

        return null;
      } catch (error) {
        functions.logger.error("Error in markRequestsAsTimeout", {
          error: error.message,
          stack: error.stack,
        });
        return null;
      }
    });

/**
 * Real-time check when a request is read or modified.
 * If expectedReturn time has passed and status is pending, update it to timeout.
 */
exports.checkAndMarkRequestTimeout = functions.firestore
    .document("requests/{requestId}")
    .onRead(async (snap, context) => {
      const request = snap.data();
      const db = admin.firestore();

      // Only process pending requests
      if (request.status !== "pending") {
        return null;
      }

      try {
        // Parse expected return time
        const [expHour, expMin] = (request.expectedReturn || "00:00")
            .split(":")
            .map(Number);
        const requestDate = new Date(request.date);
        const expectedDateTime = new Date(
            requestDate.getFullYear(),
            requestDate.getMonth(),
            requestDate.getDate(),
            expHour,
            expMin,
        );

        const now = new Date();

        // If current time has passed expected return and still pending
        if (now > expectedDateTime) {
          await snap.ref.update({
            status: "timeout",
            timedOutAt: admin.firestore.FieldValue.serverTimestamp(),
            remarks: request.remarks || "Request expired - No approval/rejection by return time",
          });

          // Notify student
          const studentRef = db.collection("users").doc(request.studentId);
          const studentSnap = await studentRef.get();

          if (studentSnap.exists) {
            const studentData = studentSnap.data();
            if (studentData.fcmToken) {
              await sendPushNotification({
                token: studentData.fcmToken,
                title: "⏱ Request Timeout",
                body: `Your out-of-mess request for ${request.date} (${request.outTime}-${request.expectedReturn}) has expired and moved to "Time Over" section.`,
                data: {
                  type: "request_timeout",
                  requestId: context.params.requestId,
                  date: request.date,
                },
              });
            }
          }

          functions.logger.info(
              "Real-time timeout check triggered",
              {
                requestId: context.params.requestId,
                date: request.date,
                expectedReturn: request.expectedReturn,
              },
          );
        }
      } catch (error) {
        functions.logger.error("Error in checkAndMarkRequestTimeout", {
          requestId: context.params.requestId,
          error: error.message,
        });
      }

      return null;
    });
