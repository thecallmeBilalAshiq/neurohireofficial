/**
 * Cleans job description text by removing:
 * - Markdown comments (<!-- -->)
 * - Code block markers (```)
 * - Asterisks used for formatting (*)
 * - HTML comments
 * - Extra whitespace
 * - Markdown headers (#)
 * 
 * @param {string} text - The text to clean
 * @returns {string} - Cleaned, professional text ready for copy-paste
 */
function cleanJobDescription(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let cleaned = text;

  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove markdown code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');

  // Remove inline code markers
  cleaned = cleaned.replace(/`[^`]+`/g, (match) => match.replace(/`/g, ''));

  // Remove markdown headers (# ## ###)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

  // Remove asterisks used for formatting (but keep asterisks in regular text)
  // Remove standalone asterisks at line start/end
  cleaned = cleaned.replace(/^\s*\*+\s*/gm, '');
  cleaned = cleaned.replace(/\s*\*+\s*$/gm, '');

  // Remove bold/italic markdown markers (**text** or *text*)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');

  // Remove markdown list markers (-, *, +)
  cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, '');

  // Remove numbered list markers (1. 2. etc.)
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, '');

  // Clean up extra whitespace (but preserve intentional spacing)
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n'); // Max 3 consecutive newlines (preserve section breaks)
  cleaned = cleaned.replace(/[ \t]{3,}/g, '  '); // Multiple spaces to max 2 spaces (preserve indentation)
  cleaned = cleaned.replace(/^\s+/gm, ''); // Leading whitespace on lines
  cleaned = cleaned.replace(/\s+$/gm, ''); // Trailing whitespace on lines

  // Remove empty lines at start and end
  cleaned = cleaned.trim();

  return cleaned;
}

module.exports = { cleanJobDescription };

