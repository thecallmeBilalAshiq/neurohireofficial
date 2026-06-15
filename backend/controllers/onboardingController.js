const Application = require('../models/Application');
const JobPost = require('../models/JobPost');
const jiraService = require('../services/jiraService');
const { runLlm, extractTextFromOutput } = require('../services/openRouterService');

// Static fallback weekly program
const fallbackWeeklyPlan = [
  { weekNumber: 1, title: "Company Orientation & Local Dev Setup", description: "Get familiar with the team structure, company handbook, and set up your local development environment with the job stack.", deliverables: "Local setup complete, hello-world app running." },
  { weekNumber: 2, title: "Version Control & Branching Workflow", description: "Understand project repositories, branching strategy (Git Flow), pull requests review standards, and code guidelines.", deliverables: "Submit a dummy pull request with correct formatting." },
  { weekNumber: 3, title: "Database Architecture & Mappings", description: "Familiarize yourself with the database schemas (relational/NoSQL), run migrations, seed mock data, and test connections.", deliverables: "Write a query / Mongoose populate query for a common use-case." },
  { weekNumber: 4, title: "Backend API Exploration & Integration", description: "Learn about the backend API structure, routing, authentication middleware, and existing helper services.", deliverables: "Expose a new debug endpoint and test it with Postman." },
  { weekNumber: 5, title: "Frontend Component Lifecycle", description: "Understand state management, CSS styling patterns, responsive design, and dynamic rendering.", deliverables: "Create a simple dashboard widget matching the design system." },
  { weekNumber: 6, title: "Writing Unit and Integration Tests", description: "Explore the testing framework (Jest, Mocha, etc.) and write tests covering boundary conditions.", deliverables: "Submit unit tests achieving >80% code coverage on a target module." },
  { weekNumber: 7, title: "First Sprint Task & Bug Fixes", description: "Pick a small item from the active sprint backlog, understand requirements, write code, test, and request review.", deliverables: "Resolve a bug and merge the fix into developer branch." },
  { weekNumber: 8, title: "Performance Optimization & Refactoring", description: "Analyze API response times or frontend rendering speeds. Identify bottlenecks and refactor slow blocks.", deliverables: "Refactored code with performance metrics before and after." },
  { weekNumber: 9, title: "CI/CD Pipeline & Automated Deployments", description: "Learn about the deployment stages, pipeline triggers, configuration variables, and environment gating.", deliverables: "Successful staging deployment verification report." },
  { weekNumber: 10, title: "Security Best Practices & Auditing", description: "Check code for common vulnerabilities (SQLi, XSS, insecure dependencies) and implement mitigation strategies.", deliverables: "Security audit checklist filled out for your module." },
  { weekNumber: 11, title: "Production Monitoring & Logging", description: "Set up alerts, understand logging standards (Winston, Morgan), error tracking (Sentry), and error boundaries.", deliverables: "Add structured logging to your recent module." },
  { weekNumber: 12, title: "Final Onboarding Review & Feature Demo", description: "Prepare a live demonstration of features implemented during the onboarding period and review progress.", deliverables: "15-minute demo to the team and HR review questionnaire." }
];

function parseWeeklyPlanFromLLM(text) {
  try {
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const arr = JSON.parse(clean);
    if (Array.isArray(arr) && arr.length >= 12) {
      return arr.slice(0, 12).map((item, idx) => ({
        weekNumber: item.weekNumber || (idx + 1),
        title: item.title || `Week ${idx + 1} Onboarding`,
        description: item.description || '',
        deliverables: item.deliverables || ''
      }));
    }
  } catch (err) {
    console.warn('[OnboardingController] JSON parse failed for weekly plan. Returning fallback plan.');
  }
  return null;
}

/**
 * Initiates the 12-week JIRA onboarding program.
 * Generates tasks via LLM or fallback, then creates issues on JIRA.
 */
exports.initiateOnboarding = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const application = await Application.findById(applicationId).populate('candidate', 'name email');
    if (!application) return res.status(404).json({ error: 'Application not found' });

    const jobPost = await JobPost.findOne({ _id: application.jobPost, createdBy: req.user._id });
    if (!jobPost) return res.status(404).json({ error: 'Job post not found or not owned by you' });

    if (!application.selectedAsHire) {
      return res.status(400).json({ error: 'Candidate is not hired yet.' });
    }

    if (application.onboardingStatus !== 'none') {
      return res.status(400).json({ error: 'Onboarding program already initiated.' });
    }

    application.onboardingStatus = 'generating';
    await application.save();

    const candidateName = application.candidate?.name || `${application.formData?.firstName || ''} ${application.formData?.lastName || ''}`.trim() || 'Candidate';
    const skillsStr = jobPost.skills?.join(', ') || 'software development';

    // 1. Generate Onboarding tasks via LLM
    const prompt = `You are an expert HR Onboarding Director. Generate a tailored 12-week onboarding and training program for a newly hired candidate.
Job Title: ${jobPost.jobTitle}
Key Skills: ${skillsStr}
Company: ${jobPost.company}
Candidate Name: ${candidateName}

Output a JSON array of exactly 12 objects. Each object must have exactly these keys:
"weekNumber": number (1 to 12),
"title": string (the objective of the week),
"description": string (actionable onboarding steps for this week),
"deliverables": string (what the candidate must submit at the end of the week)

Reply with ONLY the valid JSON array starting with [ and ending with ]. Do not wrap it in markdown or add extra text.`;

    let weeks = [];
    try {
      const result = await runLlm([{ role: 'user', content: prompt }], 8192);
      if (result && typeof result === 'object' && !result.error) {
        const output = result?.output ?? result?.content ?? result?.text ?? result;
        weeks = parseWeeklyPlanFromLLM(extractTextFromOutput(output));
      }
    } catch (llmErr) {
      console.error('[OnboardingController] LLM generation failed:', llmErr.message);
    }

    if (!weeks || weeks.length < 12) {
      console.log('[OnboardingController] Falling back to static 12-week software engineering onboarding program.');
      weeks = fallbackWeeklyPlan;
    }

    // 2. Create tasks on JIRA in parallel
    const taskPromises = weeks.map(async (week) => {
      const summary = `[NeuroHire Onboarding] Week ${week.weekNumber}: ${week.title} - ${candidateName}`;
      const desc = `Candidate: ${candidateName}\nEmail: ${application.candidate?.email || 'N/A'}\n\nObjective:\n${week.description}\n\nDeliverables:\n${week.deliverables}`;
      const labels = ['neurohire', `candidate-${applicationId}`, `week-${week.weekNumber}`];

      const jiraIssue = await jiraService.createIssue(summary, desc, labels);
      return {
        weekNumber: week.weekNumber,
        jiraIssueKey: jiraIssue.key,
        jiraIssueId: jiraIssue.id,
        title: week.title,
        description: week.description,
        deliverables: week.deliverables,
        jiraStatus: 'To Do'
      };
    });

    const onboardingTasks = await Promise.all(taskPromises);
    onboardingTasks.sort((a, b) => a.weekNumber - b.weekNumber);

    application.onboardingTasks = onboardingTasks;
    application.onboardingStatus = 'active';
    await application.save();

    res.json({
      success: true,
      message: 'Onboarding program successfully initiated and tasks created on JIRA.',
      onboardingTasksCount: onboardingTasks.length,
      jiraConfigured: jiraService.isConfigured()
    });

  } catch (error) {
    console.error('[OnboardingController] Initiate error:', error);
    try {
      await Application.findByIdAndUpdate(applicationId, { onboardingStatus: 'none', onboardingTasks: [] });
    } catch (dbErr) {
      console.error('[OnboardingController] Failed to reset onboarding status on error:', dbErr);
    }
    res.status(500).json({ error: error.message || 'Failed to initiate onboarding program.' });
  }
};

/**
 * Fetches the progress of onboarding.
 * Polls JIRA REST API for status updates, updates local Mongoose cache, and returns summary stats.
 */
exports.getOnboardingProgress = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const application = await Application.findById(applicationId)
      .populate('candidate', 'name email')
      .populate('jobPost', 'jobTitle company');

    if (!application) return res.status(404).json({ error: 'Application not found' });

    // Authorization: HR owned JobPost OR Candidate owned Application
    if (req.user.role === 'HR') {
      const jobPost = await JobPost.findOne({ _id: application.jobPost, createdBy: req.user._id });
      if (!jobPost) return res.status(403).json({ error: 'Unauthorized to view this candidate progress.' });
    } else {
      if (application.candidate._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Unauthorized to view this progress.' });
      }
    }

    if (application.onboardingStatus === 'none') {
      return res.json({
        success: true,
        stats: {
          status: 'none',
          totalTasks: 12,
          completedTasks: 0,
          progressPercentage: 0,
          candidateName: application.candidate?.name || `${application.formData?.firstName || ''} ${application.formData?.lastName || ''}`.trim(),
          email: application.candidate?.email || application.formData?.email,
          jobTitle: application.jobPost?.jobTitle,
          company: application.jobPost?.company
        },
        tasks: []
      });
    }

    // Update statuses from JIRA in parallel (poll JIRA for updates)
    const statusPromises = application.onboardingTasks.map(async (task) => {
      const currentStatus = await jiraService.getIssueStatus(task.jiraIssueKey, task.jiraStatus);
      task.jiraStatus = currentStatus;
      const isCompleted = currentStatus.toLowerCase() === 'done' || currentStatus.toLowerCase() === 'completed';
      return { task, isCompleted };
    });

    const results = await Promise.all(statusPromises);
    let completedCount = 0;
    const updatedTasks = results.map(r => {
      if (r.isCompleted) completedCount++;
      return r.task;
    });

    application.onboardingTasks = updatedTasks;
    
    // Automatically transition onboardingStatus if all tasks completed
    if (completedCount === 12 && application.onboardingStatus === 'active') {
      application.onboardingStatus = 'completed';
    }
    await application.save();

    const stats = {
      status: application.onboardingStatus,
      totalTasks: 12,
      completedTasks: completedCount,
      progressPercentage: Math.round((completedCount / 12) * 100),
      candidateName: application.candidate?.name || `${application.formData?.firstName || ''} ${application.formData?.lastName || ''}`.trim(),
      email: application.candidate?.email || application.formData?.email,
      jobTitle: application.jobPost?.jobTitle,
      company: application.jobPost?.company,
      evaluation: application.onboardingEvaluation
    };

    res.json({
      success: true,
      stats,
      tasks: updatedTasks
    });

  } catch (error) {
    console.error('[OnboardingController] Get progress error:', error);
    res.status(500).json({ error: error.message || 'Failed to load progress.' });
  }
};

/**
 * Submits deliverables for a week.
 * Posts comment on JIRA, transitions JIRA task to Done/In Progress, and updates MongoDB.
 */
exports.submitWeeklyTask = async (req, res) => {
  try {
    const { applicationId, weekNumber } = req.params;
    const { submissionText } = req.body;

    if (!submissionText || !String(submissionText).trim()) {
      return res.status(400).json({ error: 'submissionText is required.' });
    }

    const application = await Application.findById(applicationId);
    if (!application) return res.status(404).json({ error: 'Application not found' });

    // Authorization: only the candidate themselves can submit their weekly task deliverables
    if (application.candidate.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the candidate of this application can submit weekly tasks.' });
    }

    const weekIdx = application.onboardingTasks.findIndex(t => t.weekNumber === parseInt(weekNumber, 10));
    if (weekIdx === -1) return res.status(404).json({ error: 'Task for specified week not found.' });

    const task = application.onboardingTasks[weekIdx];

    // 1. Post submission comment to JIRA
    const commentBody = `--- NeuroHire Weekly Submission (Week ${weekNumber}) ---\nSubmitted At: ${new Date().toLocaleString()}\nSubmission Notes:\n${submissionText}`;
    await jiraService.addComment(task.jiraIssueKey, commentBody);

    // 2. Transition task to 'Done' on JIRA
    await jiraService.transitionIssue(task.jiraIssueKey, 'Done');

    // 3. Update locally in MongoDB
    task.submissionText = submissionText;
    task.submittedAt = new Date();
    task.jiraStatus = 'Done';

    application.onboardingTasks[weekIdx] = task;

    // Check if all tasks are now completed
    const completedCount = application.onboardingTasks.filter(t => 
      t.weekNumber === task.weekNumber ? true : (t.jiraStatus.toLowerCase() === 'done' || t.jiraStatus.toLowerCase() === 'completed')
    ).length;

    if (completedCount === 12) {
      application.onboardingStatus = 'completed';
    }

    await application.save();

    res.json({
      success: true,
      message: `Successfully submitted deliverables for Week ${weekNumber} on JIRA.`,
      task
    });

  } catch (error) {
    console.error('[OnboardingController] Submit task error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit deliverables.' });
  }
};

/**
 * Runs the AI agent to evaluate the candidate's onboarding performance.
 * Analyzes submissions and outputs detailed report/feedback to HR.
 */
exports.evaluateOnboardingPerformance = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const application = await Application.findById(applicationId)
      .populate('candidate', 'name email')
      .populate('jobPost', 'jobTitle company');

    if (!application) return res.status(404).json({ error: 'Application not found' });

    // Authorization: only the HR who posted the job can trigger AI performance evaluation
    const jobPost = await JobPost.findOne({ _id: application.jobPost, createdBy: req.user._id });
    if (!jobPost) return res.status(403).json({ error: 'Unauthorized to evaluate this application.' });

    if (application.onboardingStatus === 'none') {
      return res.status(400).json({ error: 'Onboarding program has not been initiated.' });
    }

    const candidateName = application.candidate?.name || `${application.formData?.firstName || ''} ${application.formData?.lastName || ''}`.trim();
    const jobTitle = application.jobPost?.jobTitle;
    const company = application.jobPost?.company;

    // Build the portfolio text of submissions for LLM evaluation
    let submissionsSummary = '';
    let completedCount = 0;
    application.onboardingTasks.forEach(task => {
      const isDone = task.jiraStatus.toLowerCase() === 'done' || task.jiraStatus.toLowerCase() === 'completed' || task.submittedAt;
      if (isDone) completedCount++;
      submissionsSummary += `\n[Week ${task.weekNumber}]: ${task.title}\nJIRA Status: ${task.jiraStatus}\nSubmission deliverables:\n${task.submissionText || '(No submission text provided)'}\n---\n`;
    });

    const prompt = `You are a Senior Talent Evaluator and AI Coach. Evaluate the 12-week onboarding performance of candidate ${candidateName} for the role of ${jobTitle} at ${company}.
Below is the log of their 12 weekly tasks, JIRA statuses, and submitted deliverables:
${submissionsSummary}

Generate a comprehensive performance evaluation report for HR containing:
1. Completion Rate: Mention that they completed ${completedCount} out of 12 weekly onboarding goals.
2. Strengths Analysis: A detailed analysis of the candidate's strengths based on their submissions.
3. Improvement Areas: Specific suggestions on where the candidate can improve.
4. Final Score: Rate their overall performance out of 100.
5. Recommendation: Provide a clear HR recommendation (e.g. Pass probation, extend probation by 1 month, or terminate).

Provide the final output in a clear professional layout. Start with an executive summary table and then list detailed sections.`;

    let feedbackText = `Onboarding Evaluation for ${candidateName}:\nTotal Tasks Completed: ${completedCount}/12\n\nFallback Evaluation: The candidate completed their onboarding tasks. JIRA integration is functional.`;
    let score = Math.round((completedCount / 12) * 100);

    try {
      const result = await runLlm([{ role: 'user', content: prompt }], 4096);
      if (result && typeof result === 'object' && !result.error) {
        const output = result?.output ?? result?.content ?? result?.text ?? result;
        feedbackText = extractTextFromOutput(output);
        
        // Try to parse out a score if possible, or use standard calc
        const scoreMatch = feedbackText.match(/Score:\s*(\d+)/i) || feedbackText.match(/Rating:\s*(\d+)/i) || feedbackText.match(/(\d+)\s*\/100/);
        if (scoreMatch) {
          score = parseInt(scoreMatch[1], 10);
        }
      }
    } catch (llmErr) {
      console.error('[OnboardingController] LLM evaluation error:', llmErr.message);
    }

    application.onboardingEvaluation = {
      feedbackText,
      score,
      evaluatedAt: new Date()
    };
    application.onboardingStatus = 'evaluated';
    await application.save();

    res.json({
      success: true,
      message: 'AI Evaluation successfully generated.',
      evaluation: application.onboardingEvaluation
    });

  } catch (error) {
    console.error('[OnboardingController] Evaluation error:', error);
    res.status(500).json({ error: error.message || 'Failed to evaluate onboarding performance.' });
  }
};
