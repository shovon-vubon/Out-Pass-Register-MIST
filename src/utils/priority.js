// Priority is derived from the student's stated reason for the request.
const HIGH_CAUSES   = ['Medical Emergency', 'Blood Donation'];
const MEDIUM_CAUSES = ['Family Meeting'];

// For a free-typed reason (e.g. the "Other" option), the student can flag
// urgency by including one of these keywords anywhere in the text.
const HIGH_KEYWORDS   = /\b(emg|emergency)\b/i;
const MEDIUM_KEYWORDS = /\b(mdm|medium)\b/i;

export function getPriority(cause) {
  if (HIGH_CAUSES.includes(cause))   return 'high';
  if (MEDIUM_CAUSES.includes(cause)) return 'medium';
  if (HIGH_KEYWORDS.test(cause))     return 'high';
  if (MEDIUM_KEYWORDS.test(cause))   return 'medium';
  return 'low';
}

export const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
