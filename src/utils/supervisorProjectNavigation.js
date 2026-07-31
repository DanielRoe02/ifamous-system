const REVIEW_STATUSES = new Set([
  "Assigned",
  "Pending Supervisor Approval",
  "Pending Review",
  "Revision Required",
  "Revised Proposal Submitted",
  "Rejected",
]);

export function supervisorProjectAction(project) {
  const status = String(project?.status || "").trim();

  if (status === "Rejected") {
    return { path: "/supervisor-review", label: "View Decision", mode: "history" };
  }

  if (status === "Revision Required") {
    return { path: "/supervisor-review", label: "Waiting for Revision", mode: "waiting" };
  }

  if (status === "Revised Proposal Submitted") {
    return { path: "/supervisor-review", label: "Review Revision", mode: "revision" };
  }

  if (REVIEW_STATUSES.has(status)) {
    return { path: "/supervisor-review", label: "Review Proposal", mode: "proposal" };
  }

  return { path: "/project-journey", label: "Open Journey", mode: "journey" };
}

export function openSupervisorProject(router, project) {
  const action = supervisorProjectAction(project);
  router.push({
    path: action.path,
    query: { projectId: project?.project_id || project?.id },
  });
}
