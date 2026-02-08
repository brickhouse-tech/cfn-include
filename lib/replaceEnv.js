const passThrough = (template) => template;
const replaceProcessEnv = (template) => replaceEnv(template, process.env, false);

// Cache for compiled regex patterns to avoid re-creating them
const regexCache = new Map();

/**
 * Escape special regex characters in a string
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for regex
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get a cached regex for variable substitution
 * @param {string} key - Variable name
 * @param {boolean} withBraces - Whether to match ${key} format (true) or $key format (false)
 * @returns {RegExp} Cached regex pattern
 */
function getVarRegex(key, withBraces) {
  const cacheKey = `${key}:${withBraces}`;
  if (!regexCache.has(cacheKey)) {
    const escaped = escapeRegExp(key);
    const pattern = withBraces ? `\\$\\{${escaped}\\}` : `\\$${escaped}`;
    regexCache.set(cacheKey, new RegExp(pattern, 'g'));
  }
  return regexCache.get(cacheKey);
}

let processTemplate;

function replaceEnv(template, inject = {}, doEnv) {
  processTemplate = doEnv ? replaceProcessEnv : passThrough;

  if (!template || typeof template !== 'string') {
    return processTemplate(template);
  }

  const keys = Object.keys(inject);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const val = inject[key];

    // Use cached regex patterns instead of creating new ones each time
    const bareRegex = getVarRegex(key, false);
    const bracedRegex = getVarRegex(key, true);

    // Reset lastIndex for global regex reuse
    bareRegex.lastIndex = 0;
    bracedRegex.lastIndex = 0;

    template = template.replace(bareRegex, val).replace(bracedRegex, val);
  }

  return processTemplate(template);
}

const IsRegExVar = (str) => /\$\w+/.test(str) || /\$\{\w+\}/.test(str);

replaceEnv.IsRegExVar = IsRegExVar; // hack to be backward compat

export default replaceEnv;
export { IsRegExVar };
