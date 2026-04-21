/**
 * Criteria for jobs that should appear to candidates (browse, detail, apply).
 * Closed hiring = finished pipeline, final hire completed, or HR-marked completed.
 */
function candidateOpenForApplicationsFilter() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    activeStatus: true,
    deadline: { $gte: todayStart },
    remarks: { $nin: ['deleted', 'completed'] },
    hirePipelineStage: { $ne: 'finished' },
    finalHireCompletedAt: null,
  };
}

module.exports = { candidateOpenForApplicationsFilter };
