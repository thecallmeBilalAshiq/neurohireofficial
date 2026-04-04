const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/** Public Piston: https://github.com/engineer-man/piston — or self-host and set PISTON_API_URL */
const PISTON_URL = (process.env.PISTON_API_URL || 'https://emkc.org/api/v2/piston').replace(/\/$/, '');
const RUN_TIMEOUT_MS = 12000;
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
      done({ stdout: '', stderr: err.message || 'Failed to run', exitCode: -1 });
    });
    child.on('close', (code, signal) => {
      done({ stdout, stderr, exitCode: code ?? (signal ? -1 : 0) });
    });
    child.stdin.write(stdin);
    child.stdin.end();
    setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (_) {}
      if (!finished) {
        done({ stdout, stderr: stderr || 'Execution timed out (12s)', exitCode: -1 });
      }
    }, RUN_TIMEOUT_MS);
  });
}

/**
 * Execute code via Piston API, or Node subprocess for JavaScript if Piston fails.
 * @param {string} language - javascript, python, java, cpp, c
 */
async function runCode(language, code, stdin = '') {
  if (!code || typeof code !== 'string') {
    return { stdout: '', stderr: '', exitCode: -1, error: 'No code provided' };
  }
  if (code.length > MAX_CODE_LENGTH) {
    return { stdout: '', stderr: '', exitCode: -1, error: `Code too long (max ${MAX_CODE_LENGTH} chars)` };
  }
  if (stdin.length > MAX_STDIN_LENGTH) {
    return { stdout: '', stderr: '', exitCode: -1, error: `Input too long (max ${MAX_STDIN_LENGTH} chars)` };
  }

  const lang = LANGUAGE_MAP[language?.toLowerCase()] || 'javascript';

  if (lang === 'javascript') {
    const nodeResult = await runJavaScriptNode(code, String(stdin));
    if (nodeResult.exitCode >= 0) return nodeResult;
  }

  const { name, language: pistonLang } = pistonFileFor(lang);

  try {
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
    };
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.response?.status >= 500) {
      if (lang === 'javascript') {
        return runJavaScriptNode(code, String(stdin));
      }
      return {
        stdout: '',
        stderr: '',
        exitCode: -1,
        error: 'Code execution service is temporarily unavailable. Try again later.',
      };
    }
    const msg = err.response?.data?.message || err.message || 'Execution failed';
    return { stdout: '', stderr: msg, exitCode: -1, error: msg };
  }
}

module.exports = { runCode };
