const Application = require('../models/Application');
const JobPost = require('../models/JobPost');
const TestInvitation = require('../models/TestInvitation');
const TestAttempt = require('../models/TestAttempt');
const TestMcqPool = require('../models/TestMcqPool');
const CodingQuestion = require('../models/CodingQuestion');
const { dispatchEmailBatch } = require('../services/emailDispatchService');
const { verifyToken, requireHR } = require('../middleware/verifyHr');
const { CODING_PROBLEM_COUNT, CODING_MARKS_CAPS } = require('../config/assessmentConfig');

const asHandlers = (fn) => [verifyToken, requireHR, fn];

async function computeMcqBreakdown(attempt, jobId) {
  if (attempt.mcqBreakdown && Array.isArray(attempt.mcqBreakdown) && attempt.mcqBreakdown.length > 0) {
    return attempt.mcqBreakdown;
  }
  const mcqPool = await TestMcqPool.findOne({ jobPost: jobId }).lean();
  if (!mcqPool?.questions || !attempt.mcqOrder?.length) return [];
  const mcqOrder = attempt.mcqOrder || [];
  const mcqAnswers = attempt.mcqAnswers || [];
  const out = [];
  for (let i = 0; i < mcqOrder.length; i++) {
    const poolIdx = mcqOrder[i];
    const q = mcqPool.questions[poolIdx];
    if (!q || typeof q.correctIndex !== 'number') continue;
    const ans = mcqAnswers.find((a) => a.questionIndex === i);
    const selected = ans && typeof ans.selectedIndex === 'number' ? ans.selectedIndex : -1;
    const correct = selected === q.correctIndex;
    out.push({
      orderIndex: i,
      marksObtained: correct ? 1 : 0,
      marksMax: 1,
      questionPreview: String(q.questionText || '').slice(0, 120),
    });
  }
  return out;
}

async function computeCodingBreakdown(attempt, jobId) {
  if (attempt.codingBreakdown && Array.isArray(attempt.codingBreakdown) && attempt.codingBreakdown.length > 0) {
    return attempt.codingBreakdown;
  }
  const codingDoc = await CodingQuestion.findOne({ jobPost: jobId }).lean();
  if (!codingDoc?.questions?.length) return [];
  return codingDoc.questions.slice(0, CODING_PROBLEM_COUNT).map((cq, i) => ({
    questionIndex: i,
    title: String(cq?.title || `Problem ${i + 1}`).slice(0, 120),
    marksObtained: null,
    marksMax: CODING_MARKS_CAPS[i] ?? 23,
  }));
}

function mapCvCandidate(app) {
  return {
    _id: app._id,
    candidateName: app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim() || 'N/A',
    email: app.candidate?.email || app.formData?.email,
    phone: app.formData?.phone,
    totalScore: app.scores?.total ?? 0,
    experienceScore: app.scores?.experience ?? 0,
    projectsScore: app.scores?.projects ?? 0,
    skillsScore: app.scores?.skills ?? 0,
    certificatesScore: app.scores?.certificates ?? 0,
    educationScore: app.scores?.education ?? 0,
    languagesScore: app.scores?.languages ?? 0,
    rankedAt: app.rankedAt,
  };
}

/** CV-only ranked list (no test scores). */
exports.getCvRankedCandidates = asHandlers(async (req, res) => {
  try {
    const { jobId } = req.params;
    const jobPost = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found' });
    const applications = await Application.find({ jobPost: jobId })
      .populate('candidate', 'name email')
      .sort({ 'scores.total': -1, rankedAt: -1, createdAt: -1 });
    const candidates = applications.map(mapCvCandidate);
    res.json({
      jobTitle: jobPost.jobTitle,
      company: jobPost.company,
      deadline: jobPost.deadline,
      evaluatedAt: jobPost.evaluatedAt,
      hirePipelineStage: jobPost.hirePipelineStage,
      assessmentInviteSentAt: jobPost.assessmentInviteSentAt,
      assessmentDeadline: jobPost.assessmentDeadline,
      testContentFinalizedAt: jobPost.testContentFinalizedAt,
      remarks: jobPost.remarks,
      candidates,
    });
  } catch (e) {
    console.error('getCvRankedCandidates:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

/** All candidates invited to online test for a job + attempt status. */
exports.getTestParticipants = asHandlers(async (req, res) => {
  try {
    const { jobId } = req.params;
    const jobPost = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found' });
    const invitations = await TestInvitation.find({ jobPost: jobId }).lean();
    const appIds = invitations.map((i) => i.application);
    if (!appIds.length) {
      return res.json({
        jobTitle: jobPost.jobTitle,
        company: jobPost.company,
        deadline: jobPost.deadline,
        assessmentDeadline: jobPost.assessmentDeadline,
        hirePipelineStage: jobPost.hirePipelineStage,
        awaitingFinalHireSelection: jobPost.awaitingFinalHireSelection,
        finalHireCompletedAt: jobPost.finalHireCompletedAt,
        noHireSelected: jobPost.noHireSelected,
        physicalInterviewEmailSentAt: jobPost.physicalInterviewEmailSentAt,
        physicalInterviewDate: jobPost.physicalInterviewDate,
        physicalInterviewTime: jobPost.physicalInterviewTime,
        physicalInterviewLocation: jobPost.physicalInterviewLocation,
        closureReason: jobPost.closureReason || '',
        candidates: [],
      });
    }
    const invByApp = {};
    invitations.forEach((inv) => {
      invByApp[inv.application.toString()] = inv;
    });
    const invIds = invitations.map((i) => i._id);
    const attempts = await TestAttempt.find({ testInvitation: { $in: invIds } })
      .select('testInvitation status testScore mcqScore codingScore submittedAt')
      .lean();
    const attByInv = {};
    attempts.forEach((a) => {
      attByInv[a.testInvitation.toString()] = a;
    });
    const applications = await Application.find({ _id: { $in: appIds } })
      .populate('candidate', 'name email')
      .lean();
    const list = applications.map((app) => {
      const inv = invByApp[app._id.toString()];
      const att = inv ? attByInv[inv._id.toString()] : null;
      const submitted = att?.status === 'submitted';
      const disqualified = att?.status === 'disqualified';
      return {
        _id: app._id,
        candidateName: app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim() || 'N/A',
        email: app.candidate?.email || app.formData?.email,
        phone: app.formData?.phone,
        testStatus: submitted ? 'completed' : disqualified ? 'disqualified' : att ? att.status : 'pending',
        testScore: submitted && typeof att.testScore === 'number' ? att.testScore : null,
        mcqScore: submitted ? att?.mcqScore ?? null : null,
        codingScore: submitted ? att?.codingScore ?? null : null,
        submittedAt: att?.submittedAt || null,
        physicalInterviewInvitedAt: app.physicalInterviewInvitedAt || null,
        selectedAsHire: app.selectedAsHire || false,
      };
    });
    list.sort((a, b) => {
      const aD = a.testStatus === 'disqualified' ? 1 : 0;
      const bD = b.testStatus === 'disqualified' ? 1 : 0;
      if (aD !== bD) return aD - bD;
      return (b.testScore ?? -1) - (a.testScore ?? -1);
    });
    res.json({
      jobTitle: jobPost.jobTitle,
      company: jobPost.company,
      deadline: jobPost.deadline,
      assessmentDeadline: jobPost.assessmentDeadline,
      hirePipelineStage: jobPost.hirePipelineStage,
      awaitingFinalHireSelection: jobPost.awaitingFinalHireSelection,
      finalHireCompletedAt: jobPost.finalHireCompletedAt,
      noHireSelected: jobPost.noHireSelected,
      physicalInterviewEmailSentAt: jobPost.physicalInterviewEmailSentAt,
      physicalInterviewDate: jobPost.physicalInterviewDate,
      physicalInterviewTime: jobPost.physicalInterviewTime,
      physicalInterviewLocation: jobPost.physicalInterviewLocation,
      closureReason: jobPost.closureReason || '',
      candidates: list,
    });
  } catch (e) {
    console.error('getTestParticipants:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

exports.getTestParticipantDetail = asHandlers(async (req, res) => {
  try {
    const { applicationId } = req.params;
    const app = await Application.findById(applicationId).populate('candidate', 'name email');
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const jobPost = await JobPost.findOne({ _id: app.jobPost, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found' });
    const inv = await TestInvitation.findOne({ application: applicationId });
    if (!inv) return res.status(404).json({ error: 'No test invitation for this application' });
    const attempt = await TestAttempt.findOne({ testInvitation: inv._id }).lean();
    const jobId = app.jobPost;
    if (attempt?.status === 'disqualified') {
      return res.json({
        applicationId: app._id,
        candidateName: app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim(),
        email: app.candidate?.email || app.formData?.email,
        testScore: null,
        mcqTotal: null,
        mcqMax: 30,
        codingTotal: null,
        codingMax: 70,
        mcqBreakdown: [],
        codingBreakdown: [],
        status: 'disqualified',
        disqualifiedDueToProctoring: true,
        disqualificationMessage: 'Disqualified due to proctoring rules violation. Not eligible for ranking or interview shortlist by test score.',
        submittedAt: attempt?.submittedAt || null,
      });
    }
    const mcqBreakdown = attempt ? await computeMcqBreakdown(attempt, jobId) : [];
    const codingBreakdown = attempt ? await computeCodingBreakdown(attempt, jobId) : [];
    const mcqTotal = typeof attempt?.mcqScore === 'number'
      ? attempt.mcqScore
      : mcqBreakdown.reduce((s, r) => s + (Number(r.marksObtained) || 0), 0);
    const codingTotal = attempt?.codingScore ?? null;
    res.json({
      applicationId: app._id,
      candidateName: app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim(),
      email: app.candidate?.email || app.formData?.email,
      testScore: attempt?.testScore ?? null,
      mcqTotal,
      mcqMax: 30,
      codingTotal,
      codingMax: 70,
      mcqBreakdown,
      codingBreakdown,
      status: attempt?.status || 'pending',
      disqualifiedDueToProctoring: false,
      submittedAt: attempt?.submittedAt || null,
    });
  } catch (e) {
    console.error('getTestParticipantDetail:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

function personalizePhysicalBody(body, hrInfo, jobInfo, candidateName, dateStr, timeStr, locStr) {
  return body
    .replace(/\[CANDIDATE_NAME\]/g, candidateName || 'Candidate')
    .replace(/\[HR_NAME\]/g, hrInfo?.name || 'HR Team')
    .replace(/\[HR_TITLE\]/g, hrInfo?.title || 'Human Resources')
    .replace(/\[COMPANY_NAME\]/g, jobInfo?.company || 'Our Company')
    .replace(/\[COMPANY_EMAIL\]/g, hrInfo?.email || 'hr@company.com')
    .replace(/\[COMPANY_PHONE\]/g, hrInfo?.phone || '')
    .replace(/\[INTERVIEW_DATE\]/g, dateStr || 'TBC')
    .replace(/\[DATE\]/g, dateStr || 'TBC')
    .replace(/\[INTERVIEW_TIME\]/g, timeStr || 'TBC')
    .replace(/\[TIME\]/g, timeStr || 'TBC')
    .replace(/\[INTERVIEW_LOCATION\/LINK\]/g, locStr || 'TBC')
    .replace(/\[INTERVIEW_LOCATION\]/g, locStr || 'TBC');
}

/** After assessment deadline: invite subset to physical interview; condolence to others who were in test pool. */
exports.sendPhysicalInterviewRound = asHandlers(async (req, res) => {
  try {
    const { jobId } = req.params;
    const {
      mode,
      applicationIds,
      interviewDate,
      interviewTime,
      interviewLocation,
      emailSubject,
      emailBody,
      hrInfo,
    } = req.body;

    const job = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!job) return res.status(404).json({ error: 'Job post not found' });
    if (!job.assessmentInviteSentAt) {
      return res.status(400).json({ error: 'Online test invitations must be sent first.' });
    }
    if (job.hirePipelineStage === 'finished' || job.finalHireCompletedAt) {
      return res.status(400).json({ error: 'This job is already closed.' });
    }
    if (job.physicalInterviewEmailSentAt) {
      return res.status(400).json({ error: 'Physical interview round already sent.' });
    }
    const now = new Date();
    if (job.assessmentDeadline && now < new Date(job.assessmentDeadline)) {
      return res.status(400).json({
        error: 'Assessment deadline has not passed yet. You can send physical interview invites after the test window ends.',
      });
    }
    if (!emailSubject || !emailBody) {
      return res.status(400).json({ error: 'emailSubject and emailBody required' });
    }

    const invitations = await TestInvitation.find({ jobPost: jobId }).lean();
    const appIds = invitations.map((i) => i.application.toString());
    const applications = await Application.find({ _id: { $in: appIds } })
      .populate('candidate', 'name email')
      .lean();

    const invIds = invitations.map((i) => i._id);
    const attemptsAll = await TestAttempt.find({ testInvitation: { $in: invIds } })
      .select('testInvitation status testScore')
      .lean();
    const disqInvIds = new Set(
      attemptsAll.filter((a) => a.status === 'disqualified').map((a) => a.testInvitation.toString())
    );
    const disqualifiedAppIdSet = new Set();
    invitations.forEach((inv) => {
      if (disqInvIds.has(inv._id.toString())) disqualifiedAppIdSet.add(inv.application.toString());
    });

    const attempts = attemptsAll.filter((a) => a.status === 'submitted');
    const scoreByInv = {};
    attempts.forEach((a) => {
      scoreByInv[a.testInvitation.toString()] = a.testScore ?? 0;
    });
    const invByApp = {};
    invitations.forEach((inv) => {
      invByApp[inv.application.toString()] = inv;
    });

    const withScores = applications
      .filter((a) => !disqualifiedAppIdSet.has(a._id.toString()))
      .map((a) => {
        const inv = invByApp[a._id.toString()];
        const ts = inv ? scoreByInv[inv._id.toString()] : null;
        return { app: a, testScore: ts == null ? -1 : ts };
      });
    withScores.sort((x, y) => y.testScore - x.testScore);

    let selected = [];
    if (mode === 'manual') {
      const ids = new Set((applicationIds || []).map(String).filter((id) => !disqualifiedAppIdSet.has(id)));
      selected = withScores.filter((x) => ids.has(x.app._id.toString())).map((x) => x.app);
    } else {
      const n = mode === 'top3' ? 3 : mode === 'top5' ? 5 : mode === 'top10' ? 10 : 0;
      if (!n) return res.status(400).json({ error: 'mode must be manual, top3, top5, or top10' });
      selected = withScores.filter((x) => x.testScore >= 0).slice(0, n).map((x) => x.app);
      if (selected.length === 0) {
        selected = withScores.slice(0, n).map((x) => x.app);
      }
    }

    if (!selected.length) {
      return res.status(400).json({ error: 'No candidates selected for physical interview.' });
    }

    const selectedSet = new Set(selected.map((a) => a._id.toString()));
    const jInfo = { jobTitle: job.jobTitle, company: job.company };
    const dateStr = interviewDate || '';
    const timeStr = interviewTime || '';
    const locStr = interviewLocation || '';

    const emails = selected
      .map((app) => {
        const email = app.candidate?.email || app.formData?.email;
        if (!email) return null;
        const name = app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim() || 'Candidate';
        const body = personalizePhysicalBody(emailBody, hrInfo, jInfo, name, dateStr, timeStr, locStr);
        const subject = emailSubject.replace(/\[CANDIDATE_NAME\]/g, name);
        return { to: email, subject, body, candidateName: name, jobTitle: jInfo.jobTitle, company: jInfo.company };
      })
      .filter(Boolean);

    await dispatchEmailBatch(emails, { ...jInfo, type: 'physical_interview' });

    const physNow = new Date();
    await Application.updateMany(
      { _id: { $in: selected.map((a) => a._id) } },
      { $set: { physicalInterviewInvitedAt: physNow } }
    );

    const notSelected = applications.filter((a) => !selectedSet.has(a._id.toString()));
    const condSubject = `Update on your application — ${jInfo.jobTitle}`;
    const condEmails = notSelected
      .map((app) => {
        const email = app.candidate?.email || app.formData?.email;
        if (!email) return null;
        const name = app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim() || 'Candidate';
        const body =
          `Dear ${name},\n\n` +
          `Thank you again for completing the online assessment for the ${jInfo.jobTitle} role at ${jInfo.company}. We appreciate the effort and thought you put in.\n\n` +
          `We will not be moving forward with your candidacy for this position. This outcome reflects the strength of the current applicant pool, not a judgment of your long-term potential.\n\n` +
          `Please stay in touch and consider applying for future openings—we would be glad to see your name again.\n\n` +
          `Warm wishes for your continued success,\n${hrInfo?.name || 'The Hiring Team'}\n${jInfo.company || ''}`;
        return { to: email, subject: condSubject, body, candidateName: name, jobTitle: jInfo.jobTitle, company: jInfo.company };
      })
      .filter(Boolean);

    if (condEmails.length) {
      await dispatchEmailBatch(condEmails, { ...jInfo, type: 'condolence_post_test' });
      await Application.updateMany(
        { _id: { $in: notSelected.map((a) => a._id) } },
        { $set: { condolenceAfterPhysicalSentAt: physNow } }
      );
    }

    job.physicalInterviewDate = dateStr;
    job.physicalInterviewTime = timeStr;
    job.physicalInterviewLocation = locStr;
    job.physicalInterviewEmailSentAt = physNow;
    job.hirePipelineStage = 'physical_invite_sent';
    job.awaitingFinalHireSelection = true;
    await job.save();

    res.json({
      success: true,
      invitedCount: emails.length,
      condolenceCount: condEmails.length,
    });
  } catch (e) {
    console.error('sendPhysicalInterviewRound:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

/** Final hire selection or no-hire; sends congrats or condolence; closes job. */
exports.completeFinalHire = asHandlers(async (req, res) => {
  try {
    const { jobId } = req.params;
    const { applicationIds, hrInfo } = req.body;
    const job = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!job) return res.status(404).json({ error: 'Job post not found' });
    if (!job.awaitingFinalHireSelection) {
      return res.status(400).json({ error: 'Physical interview step not completed or already finalized.' });
    }
    if (job.finalHireCompletedAt) {
      return res.status(400).json({ error: 'Hiring already finalized for this job.' });
    }

    const ids = Array.isArray(applicationIds) ? applicationIds.map(String) : [];
    const jInfo = { jobTitle: job.jobTitle, company: job.company };
    const completedAt = new Date();

    const physicalApps = await Application.find({
      jobPost: jobId,
      physicalInterviewInvitedAt: { $ne: null },
    })
      .populate('candidate', 'name email')
      .lean();

    if (ids.length === 0) {
      job.noHireSelected = true;
      job.awaitingFinalHireSelection = false;
      job.finalHireCompletedAt = completedAt;
      job.hirePipelineStage = 'finished';
      job.remarks = 'completed';
      job.closureReason = '';
      await job.save();

      const emails = physicalApps
        .map((app) => {
          const email = app.candidate?.email || app.formData?.email;
          if (!email) return null;
          const name = app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim() || 'Candidate';
          const body =
            `Dear ${name},\n\n` +
            `Thank you for your time and engagement throughout the ${jInfo.jobTitle} hiring process at ${jInfo.company}. After thorough consideration, we will not be extending an offer for this role at this time.\n\n` +
            `This was a difficult decision given the quality of conversations we had. We hope you will keep us in mind and apply again when new opportunities arise.\n\n` +
            `Wishing you clarity and success in your next chapter,\n${hrInfo?.name || 'The Hiring Team'}\n${jInfo.company || ''}`;
          return {
            to: email,
            subject: `Update regarding the ${jInfo.jobTitle} position`,
            body,
            candidateName: name,
            jobTitle: jInfo.jobTitle,
            company: jInfo.company,
          };
        })
        .filter(Boolean);
      if (emails.length) await dispatchEmailBatch(emails, { ...jInfo, type: 'condolence_no_hire' });

      await Application.updateMany(
        { jobPost: jobId, physicalInterviewInvitedAt: { $ne: null } },
        { $set: { condolenceNotFinalHireSentAt: completedAt } }
      );

      return res.json({ success: true, noHire: true, message: 'Role closed without a hire. Candidates have been notified.' });
    }

    await Application.updateMany({ jobPost: jobId }, { $set: { selectedAsHire: false } });
    await Application.updateMany(
      { _id: { $in: ids }, jobPost: jobId },
      { $set: { selectedAsHire: true } }
    );

    const selectedApps = await Application.find({ _id: { $in: ids }, jobPost: jobId })
      .populate('candidate', 'name email')
      .lean();

    const congrats = selectedApps
      .map((app) => {
        const email = app.candidate?.email || app.formData?.email;
        if (!email) return null;
        const name = app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim() || 'Candidate';
        const body =
          `Dear ${name},\n\n` +
          `Congratulations! We are delighted to confirm that you have been selected for the ${jInfo.jobTitle} position at ${jInfo.company}.\n\n` +
          `Further practical details (start date, documentation, and onboarding steps) will be shared with you directly by our HR team in a separate message.\n\n` +
          `We are excited about what you will bring to the team.\n\n` +
          `Warm congratulations,\n${hrInfo?.name || 'Human Resources'}\n${jInfo.company || ''}`;
        return {
          to: email,
          subject: `Congratulations — ${jInfo.jobTitle} at ${jInfo.company}`,
          body,
          candidateName: name,
          jobTitle: jInfo.jobTitle,
          company: jInfo.company,
        };
      })
      .filter(Boolean);
    if (congrats.length) await dispatchEmailBatch(congrats, { ...jInfo, type: 'congratulations_hire' });

    await Application.updateMany(
      { _id: { $in: ids } },
      { $set: { congratulationsHireSentAt: completedAt } }
    );

    const selectedSet = new Set(ids);
    const notChosen = physicalApps.filter((a) => !selectedSet.has(a._id.toString()));
    const condEmails = notChosen
      .map((app) => {
        const email = app.candidate?.email || app.formData?.email;
        if (!email) return null;
        const name = app.candidate?.name || `${app.formData?.firstName || ''} ${app.formData?.lastName || ''}`.trim() || 'Candidate';
        const body =
          `Dear ${name},\n\n` +
          `Thank you for investing your time in the final stages of the ${jInfo.jobTitle} process at ${jInfo.company}. After careful deliberation, we have extended an offer to another candidate whose profile was an exceptionally close match for our immediate needs.\n\n` +
          `Please do not view this as a reflection of your abilities—we would welcome future applications from you.\n\n` +
          `All the best in your career journey,\n${hrInfo?.name || 'The Hiring Team'}\n${jInfo.company || ''}`;
        return {
          to: email,
          subject: `Thank you — ${jInfo.jobTitle}`,
          body,
          candidateName: name,
          jobTitle: jInfo.jobTitle,
          company: jInfo.company,
        };
      })
      .filter(Boolean);
    if (condEmails.length) {
      await dispatchEmailBatch(condEmails, { ...jInfo, type: 'condolence_not_final_hire' });
      await Application.updateMany(
        { _id: { $in: notChosen.map((a) => a._id) } },
        { $set: { condolenceNotFinalHireSentAt: completedAt } }
      );
    }

    job.awaitingFinalHireSelection = false;
    job.finalHireCompletedAt = completedAt;
    job.hirePipelineStage = 'finished';
    job.remarks = 'completed';
    job.noHireSelected = false;
    job.closureReason = '';
    await job.save();

    res.json({ success: true, hiredCount: congrats.length });
  } catch (e) {
    console.error('completeFinalHire:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

/** Hired candidates across HR jobs (onboarding view). */
exports.getOnboardingHires = asHandlers(async (req, res) => {
  try {
    const jobs = await JobPost.find({
      createdBy: req.user._id,
      remarks: { $ne: 'deleted' },
    })
      .select('jobTitle company _id hirePipelineStage finalHireCompletedAt')
      .lean();
    const jobIds = jobs.map((j) => j._id);
    const hires = await Application.find({
      jobPost: { $in: jobIds },
      selectedAsHire: true,
    })
      .populate('candidate', 'name email')
      .populate('jobPost', 'jobTitle company')
      .sort({ updatedAt: -1 })
      .lean();

    const rows = hires.map((a) => ({
      applicationId: a._id,
      jobId: a.jobPost?._id,
      jobTitle: a.jobPost?.jobTitle,
      company: a.jobPost?.company,
      candidateName: a.candidate?.name || `${a.formData?.firstName || ''} ${a.formData?.lastName || ''}`.trim(),
      email: a.candidate?.email || a.formData?.email,
      phone: a.formData?.phone,
      congratulationsHireSentAt: a.congratulationsHireSentAt,
      trainingPlanPdfPath: a.trainingPlanPdfPath,
    }));

    res.json({ hires: rows });
  } catch (e) {
    console.error('getOnboardingHires:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

/** Close job when there are no test participants OR all invited candidates were disqualified — no one eligible to shortlist. */
exports.closeJobNoEligibleCandidates = asHandlers(async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await JobPost.findOne({ _id: jobId, createdBy: req.user._id });
    if (!job) return res.status(404).json({ error: 'Job post not found' });
    if (job.finalHireCompletedAt || job.hirePipelineStage === 'finished') {
      return res.status(400).json({ error: 'This job is already closed.' });
    }
    if (!job.assessmentInviteSentAt) {
      return res.status(400).json({ error: 'Send the online assessment first before using this closure.' });
    }
    const now = new Date();
    if (job.assessmentDeadline && now < new Date(job.assessmentDeadline)) {
      return res.status(400).json({
        error: 'Assessment deadline has not passed yet. Wait until the test window ends.',
      });
    }
    if (job.physicalInterviewEmailSentAt) {
      return res.status(400).json({
        error: 'Physical interview round already sent. Use final hiring decision or no-hire to close.',
      });
    }

    const invitations = await TestInvitation.find({ jobPost: jobId }).lean();
    const appIds = invitations.map((i) => i.application);

    let allowClose = false;
    if (appIds.length === 0) {
      allowClose = true;
    } else {
      const invIds = invitations.map((i) => i._id);
      const attempts = await TestAttempt.find({ testInvitation: { $in: invIds } })
        .select('testInvitation status')
        .lean();
      const disqInvIds = new Set(
        attempts.filter((a) => a.status === 'disqualified').map((a) => a.testInvitation.toString())
      );
      const disqualifiedAppIdSet = new Set();
      invitations.forEach((inv) => {
        if (disqInvIds.has(inv._id.toString())) disqualifiedAppIdSet.add(inv.application.toString());
      });
      const applications = await Application.find({ _id: { $in: appIds } }).select('_id').lean();
      const allDisqualified =
        applications.length > 0 &&
        applications.every((a) => disqualifiedAppIdSet.has(a._id.toString()));
      allowClose = allDisqualified;
    }

    if (!allowClose) {
      return res.status(400).json({
        error:
          'Only available when there are no test participants, or every participant was disqualified (e.g. proctoring).',
      });
    }

    job.hirePipelineStage = 'finished';
    job.finalHireCompletedAt = now;
    job.awaitingFinalHireSelection = false;
    job.noHireSelected = true;
    job.remarks = 'completed';
    job.closureReason = 'no_eligible_pool';
    await job.save();

    res.json({
      success: true,
      message:
        'We are sorry — no candidate was up to the mark for this role. The job has been closed.',
    });
  } catch (e) {
    console.error('closeJobNoEligibleCandidates:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});
