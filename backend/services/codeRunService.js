const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Code execution order:
 * 1. CODE_RUN_WEBHOOK_URL (custom / OpenJudge-style adapter) if set
 * 2. Judge0 CE public API (https://ce.judge0.com) — free tier, no API key
 * 3. Local Node for JavaScript (unless USE_PISTON_FOR_JAVASCRIPT=1)
 * 4. Piston (emkc.org or PISTON_API_URL)
 *
 * Disable Judge0: DISABLE_JUDGE0=1
 */
const PISTON_URL = (process.env.PISTON_API_URL || 'https://emkc.org/api/v2/piston').replace(/\/$/, '');
const JUDGE0_URL = (process.env.JUDGE0_API_URL || 'https://ce.judge0.com').replace(/\/$/, '');
const CODE_RUN_WEBHOOK_URL = (process.env.CODE_RUN_WEBHOOK_URL || '').trim();
const USE_PISTON_FOR_JS = process.env.USE_PISTON_FOR_JAVASCRIPT === '1' || process.env.USE_PISTON_FOR_JAVASCRIPT === 'true';
const DISABLE_JUDGE0 = process.env.DISABLE_JUDGE0 === '1' || process.env.DISABLE_JUDGE0 === 'true';
const RUN_TIMEOUT_MS = 15000;
const MAX_CODE_LENGTH = 50000;
const MAX_STDIN_LENGTH = 10000;

const LANGUAGE_MAP = {
  javascript: 'javascript',
  js: 'javascript',
  python: 'python',
  py: 'python',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
};

/** Judge0 CE language_id (see https://ce.judge0.com/languages) */
function judge0LanguageId(lang) {
  const m = {
    javascript: 63,
    python: 71,
    java: 62,
    cpp: 54,
    c: 50,
  };
  return m[lang] || 63;
}

function pistonFileFor(lang) {
  switch (lang) {
    case 'python':
      return { name: 'main.py', language: 'python' };
    case 'java':
      return { name: 'Main.java', language: 'java' };
    case 'cpp':
      return { name: 'main.cpp', language: 'cpp' };
    case 'c':
      return { name: 'main.c', language: 'c' };
    case 'javascript':
    default:
      return { name: 'main.js', language: 'javascript' };
  }
}

function runJavaScriptNode(code, stdin) {
  return new Promise((resolve) => {
    const tmpDir = os.tmpdir();
    const filePath = path.join(tmpDir, `run_${Date.now()}_${Math.random().toString(36).slice(2)}.js`);
    fs.writeFileSync(filePath, code, 'utf8');
    const child = spawn('node', [filePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let finished = false;
    const done = (payload) => {
      if (finished) return;
      finished = true;
      try { fs.unlinkSync(filePath); } catch (_) {}
      resolve(payload);
    };
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      done({ stdout: '', stderr: err.message || 'Failed to run', exitCode: -1, runtime: 'node' });
    });
    child.on('close', (code, signal) => {
      done({ stdout, stderr, exitCode: code ?? (signal ? -1 : 0), runtime: 'node' });
    });
    child.stdin.write(stdin);
    child.stdin.end();
    setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (_) {}
      if (!finished) {
        done({ stdout, stderr: stderr || 'Execution timed out (15s)', exitCode: -1, runtime: 'node' });
      }
    }, RUN_TIMEOUT_MS);
  });
}

async function runWithJudge0(lang, code, stdin) {
  const res = await axios.post(
    `${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`,
    {
      source_code: code,
      language_id: judge0LanguageId(lang),
      stdin: String(stdin),
    },
    {
      timeout: RUN_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );
  const d = res.data || {};
  const parts = [d.stderr, d.compile_output, d.message].filter((x) => x != null && String(x).trim() !== '');
  const stderr = parts.map(String).join('\n');
  let exitCode = 0;
  if (d.exit_code != null && d.exit_code !== '') {
    exitCode = Number(d.exit_code);
  } else if (d.status && typeof d.status.id === 'number' && d.status.id > 3) {
    exitCode = -1;
  }
  return {
    stdout: d.stdout != null ? String(d.stdout) : '',
    stderr,
    exitCode: Number.isNaN(exitCode) ? -1 : exitCode,
    runtime: 'judge0',
  };
}

async function runWithPiston(lang, code, stdin) {
  const { name, language: pistonLang } = pistonFileFor(lang);
  const response = await axios.post(
    `${PISTON_URL}/execute`,
    {
      language: pistonLang,
      version: '*',
      files: [{ name, content: code }],
      stdin: String(stdin),
    },
    { timeout: RUN_TIMEOUT_MS }
  );
  const data = response.data || {};
  return {
    stdout: data.run?.stdout != null ? String(data.run.stdout) : '',
    stderr: data.run?.stderr != null ? String(data.run.stderr) : '',
    exitCode: data.run?.code != null ? Number(data.run.code) : 0,
    runtime: 'piston',
  };
}

async function runWithCustomWebhook(language, code, stdin) {
  const res = await axios.post(
    CODE_RUN_WEBHOOK_URL,
    { language, code, stdin: String(stdin) },
    { timeout: RUN_TIMEOUT_MS, headers: { 'Content-Type': 'application/json' } }
  );
  const d = res.data || {};
  return {
    stdout: d.stdout != null ? String(d.stdout) : '',
    stderr: d.stderr != null ? String(d.stderr) : '',
    exitCode: typeof d.exitCode === 'number' ? d.exitCode : d.code != null ? Number(d.code) : 0,
    error: d.error ? String(d.error) : undefined,
    runtime: 'custom',
  };
}

async function runCode(language, code, stdin = '') {
  if (!code || typeof code !== 'string') {
    return { stdout: '', stderr: '', exitCode: -1, error: 'No code provided', runtime: 'none' };
  }
  if (code.length > MAX_CODE_LENGTH) {
    return { stdout: '', stderr: '', exitCode: -1, error: `Code too long (max ${MAX_CODE_LENGTH} chars)`, runtime: 'none' };
  }
  if (stdin.length > MAX_STDIN_LENGTH) {
    return { stdout: '', stderr: '', exitCode: -1, error: `Input too long (max ${MAX_STDIN_LENGTH} chars)`, runtime: 'none' };
  }

  const lang = LANGUAGE_MAP[language?.toLowerCase()] || 'javascript';

  if (CODE_RUN_WEBHOOK_URL) {
    try {
      return await runWithCustomWebhook(lang, code, String(stdin));
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Custom executor failed';
      return { stdout: '', stderr: '', exitCode: -1, error: msg, runtime: 'custom' };
    }
  }

  if (!DISABLE_JUDGE0) {
    try {
      return await runWithJudge0(lang, code, String(stdin));
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data;
      console.warn('[codeRun] Judge0 failed, trying fallbacks:', status, detail?.error || err.message);
    }
  }

  if (lang === 'javascript' && !USE_PISTON_FOR_JS) {
    const nodeResult = await runJavaScriptNode(code, String(stdin));
    if (nodeResult.exitCode >= 0) return { ...nodeResult, runtime: 'node' };
  }

  try {
    return await runWithPiston(lang, code, String(stdin));
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.response?.status >= 500) {
      if (lang === 'javascript' && !USE_PISTON_FOR_JS) {
        const nodeResult = await runJavaScriptNode(code, String(stdin));
        return { ...nodeResult, runtime: 'node' };
      }
      return {
        stdout: '',
        stderr: '',
        exitCode: -1,
        error: 'Code execution service is temporarily unavailable. Try again later.',
        runtime: 'piston',
      };
    }
    const msg = err.response?.data?.message || err.message || 'Execution failed';
    return { stdout: '', stderr: msg, exitCode: -1, error: msg, runtime: 'piston' };
  }
}

module.exports = { runCode };
