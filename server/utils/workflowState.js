const STATUS_STATES = new Map([
  ["Draft", { phase: "Proposal", progress: 5, risk: "On Track", step: 1 }],
  ["Pending Review", { phase: "Proposal Review", progress: 10, risk: "On Track", step: 1 }],
  ["Pending Coordinator Review", { phase: "Coordinator Review", progress: 10, risk: "On Track", step: 1 }],
  ["Pending AI Matching", { phase: "AI Supervisor Matching", progress: 15, risk: "On Track", step: 2 }],
  ["Pending Supervisor Assignment", { phase: "Supervisor Assignment", progress: 20, risk: "On Track", step: 2 }],
  ["Assigned", { phase: "Supervisor Review", progress: 25, risk: "On Track", step: 2 }],
  ["Pending Supervisor Approval", { phase: "Supervisor Review", progress: 25, risk: "On Track", step: 2 }],
  ["Revision Required", { phase: "Proposal Revision", progress: 20, risk: "Needs Attention", step: 2 }],
  ["Revised Proposal Submitted", { phase: "Proposal Re-review", progress: 20, risk: "Needs Attention", step: 2 }],
  ["Rejected", { phase: "Proposal Closed", progress: 0, risk: "Closed", step: 1 }],
  ["Active", { phase: "Development in Progress", progress: 30, risk: "On Track", step: 3 }],
  ["Development in Progress", { phase: "Development in Progress", progress: 50, risk: "On Track", step: 3 }],
  ["Progress Update Submitted", { phase: "Development in Progress", progress: 60, risk: "On Track", step: 3 }],
  ["Final Deliverables Submitted", { phase: "Final Review", progress: 80, risk: "On Track", step: 4 }],
  ["Final Correction Required", { phase: "Final Correction", progress: 75, risk: "Needs Attention", step: 4 }],
  ["Approved for Examination", { phase: "Examiner Assignment", progress: 85, risk: "On Track", step: 4 }],
  ["Awaiting Examiner Assignment", { phase: "Examiner Assignment", progress: 85, risk: "On Track", step: 4 }],
  ["Examiner Assigned", { phase: "Examination", progress: 90, risk: "On Track", step: 4 }],
  ["Under Examination", { phase: "Examination", progress: 92, risk: "On Track", step: 4 }],
  ["Grading Completed", { phase: "Result Review", progress: 95, risk: "On Track", step: 5 }],
  ["Result Pending Release", { phase: "Result Review", progress: 98, risk: "On Track", step: 5 }],
  ["Result Released", { phase: "Completed", progress: 100, risk: "On Track", step: 5 }],
]);

const ACTIVE_RISK_STATUSES = new Set([
  "Active",
  "Development in Progress",
  "Progress Update Submitted",
  "Final Deliverables Submitted",
  "Final Correction Required",
]);

function workflowStateForStatus(status, storedProgress = 0) {
  const normalizedStatus = String(status || "Draft").trim();
  const base = STATUS_STATES.get(normalizedStatus) || {
    phase: normalizedStatus || "Proposal",
    progress: 0,
    risk: "On Track",
    step: 1,
  };

  const numericStored = Number(storedProgress);
  const progress = normalizedStatus === "Rejected"
    ? 0
    : normalizedStatus === "Result Released"
      ? 100
      : Math.max(base.progress, Number.isFinite(numericStored) ? numericStored : 0);

  return { ...base, status: normalizedStatus, progress: Math.min(100, progress) };
}

function isDevelopmentJourneyStatus(status) {
  return !new Set([
    "Draft",
    "Pending Review",
    "Pending Coordinator Review",
    "Pending AI Matching",
    "Pending Supervisor Assignment",
    "Assigned",
    "Pending Supervisor Approval",
    "Revision Required",
    "Revised Proposal Submitted",
    "Rejected",
  ]).has(String(status || "").trim());
}

module.exports = {
  ACTIVE_RISK_STATUSES,
  STATUS_STATES,
  isDevelopmentJourneyStatus,
  workflowStateForStatus,
};
