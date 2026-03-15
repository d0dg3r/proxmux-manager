function normalizeUrl(url) {
  const value = (url || '').toString().trim();
  if (!value) return null;
  if (!/^https:\/\/raw\.githubusercontent\.com\/community-scripts\/ProxmoxVE\/main\/[a-z0-9/_-]+\.sh$/i.test(value)) {
    return null;
  }
  return value;
}

function shellEscapeSingleQuotes(text) {
  return (text || '').replace(/'/g, "'\"'\"'");
}

export function buildInstallCommandForScript(script) {
  const url = normalizeUrl(script?.installUrl);
  if (!url) {
    throw new Error(`No trusted install URL found for "${script?.name || script?.slug || 'unknown'}".`);
  }
  return `bash -c '$(curl -fsSL ${shellEscapeSingleQuotes(url)})'`;
}

export function buildInstallCommandForScripts(scripts) {
  const items = Array.isArray(scripts) ? scripts : [];
  if (!items.length) {
    throw new Error('No scripts selected.');
  }
  return items
    .map(script => {
      const title = (script.name || script.slug || 'script').trim();
      return `# ${title}\n${buildInstallCommandForScript(script)}`;
    })
    .join('\n\n');
}
