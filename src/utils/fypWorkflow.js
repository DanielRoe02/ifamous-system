const STATUS_STEPS = new Map([
  ['Draft', 1],
  ['Pending Review', 1],
  ['Pending Coordinator Review', 1],
  ['Pending AI Matching', 2],
  ['Pending Supervisor Assignment', 2],
  ['Assigned', 2],
  ['Pending Supervisor Approval', 2],
  ['Revision Required', 2],
  ['Revised Proposal Submitted', 2],
  ['Rejected', 1],
  ['Active', 3],
  ['Development in Progress', 3],
  ['Progress Update Submitted', 3],
  ['Final Deliverables Submitted', 4],
  ['Final Correction Required', 4],
  ['Approved for Examination', 4],
  ['Awaiting Examiner Assignment', 4],
  ['Examiner Assigned', 4],
  ['Under Examination', 4],
  ['Grading Completed', 5],
  ['Result Pending Release', 5],
  ['Result Released', 5],
])

const JOURNEY_BLOCKED = new Set([
  'Draft',
  'Pending Review',
  'Pending Coordinator Review',
  'Pending AI Matching',
  'Pending Supervisor Assignment',
  'Assigned',
  'Pending Supervisor Approval',
  'Revision Required',
  'Revised Proposal Submitted',
  'Rejected',
])

export function workflowStep(status) {
  return STATUS_STEPS.get(String(status || '').trim()) || 1
}

export function canOpenJourney(status) {
  return !JOURNEY_BLOCKED.has(String(status || '').trim())
}

export function isRejected(status) {
  return String(status || '').trim() === 'Rejected'
}

export function nextActionForStatus(status) {
  const value = String(status || '').trim()
  const actions = {
    Draft: 'Complete and submit your proposal',
    'Pending Review': 'Wait for proposal review',
    'Pending Coordinator Review': 'Wait for coordinator review',
    'Pending AI Matching': 'Wait for AI supervisor matching',
    'Pending Supervisor Assignment': 'Wait for supervisor assignment',
    Assigned: 'Wait for supervisor proposal review',
    'Pending Supervisor Approval': 'Wait for supervisor proposal review',
    'Revision Required': 'Revise the proposal using the supervisor feedback',
    'Revised Proposal Submitted': 'Wait for the supervisor to review your revised proposal',
    Rejected: 'View the rejection feedback and create a new proposal when ready',
    Active: 'Begin the FYP development journey',
    'Development in Progress': 'Continue milestones, progress updates and logbooks',
    'Progress Update Submitted': 'Continue the FYP development journey',
    'Final Deliverables Submitted': 'Wait for the supervisor final-readiness decision',
    'Final Correction Required': 'Correct and resubmit the final deliverables',
    'Approved for Examination': 'Wait for examiner assignment',
    'Awaiting Examiner Assignment': 'Wait for coordinator examiner assignment',
    'Examiner Assigned': 'Wait for examination and grading',
    'Under Examination': 'The assigned examiner is reviewing the project',
    'Grading Completed': 'Wait for coordinator result review',
    'Result Pending Release': 'Wait for coordinator result release',
    'Result Released': 'Open Results & Feedback',
  }
  return actions[value] || 'Check your latest FYP status'
}
