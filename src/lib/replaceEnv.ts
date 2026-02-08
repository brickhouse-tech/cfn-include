type ProcessTemplateFn = (template: unknown) => unknown;

const passThrough: ProcessTemplateFn = (template) => template;

// Cache for compiled regex patterns to avoid re-creating them
const regexCache = new Map<string, RegExp>();

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get a cached regex for variable substitution
 */
function getVarRegex(key: string, withBraces: boolean): RegExp {
  const cacheKey = `${key}:${withBraces}`;
  if (!regexCache.has(cacheKey)) {
    const escaped = escapeRegExp(key);
    const pattern = withBraces ? `\\$\\{${escaped}\\}` : `\\$${escaped}`;
    regexCache.set(cacheKey, new RegExp(pattern, 'g'));
  }
  return regexCache.get(cacheKey)!;
}

function replaceEnv(
  template: unknown,
  inject: Record<string, unknown> = {},
  doEnv?: boolean,
): unknown {
  const replaceProcessEnv: ProcessTemplateFn = (t) => replaceEnv(t, process.env as Record<string, string>, false);
  const processTemplate: ProcessTemplateFn = doEnv ? replaceProcessEnv : passThrough;

  if (!template || typeof template !== 'string') {
    return processTemplate(template);
  }

  let result = template;
  const keys = Object.keys(inject);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const val = String(inject[key]);

    // Use cached regex patterns instead of creating new ones each time
    const bareRegex = getVarRegex(key, false);
    const bracedRegex = getVarRegex(key, true);

    // Reset lastIndex for global regex reuse
    bareRegex.lastIndex = 0;
    bracedRegex.lastIndex = 0;

    result = result.replace(bareRegex, val).replace(bracedRegex, val);
  }

  return processTemplate(result);
}

const IsRegExVar = (str: string): boolean => /\$\w+/.test(str) || /\$\{\w+\}/.test(str);

// Attach IsRegExVar as a property for backward compat
(replaceEnv as typeof replaceEnv & { IsRegExVar: typeof IsRegExVar }).IsRegExVar = IsRegExVar;

export default replaceEnv as typeof replaceEnv & { IsRegExVar: typeof IsRegExVar };
export { IsRegExVar };
