const CATALOG_CACHE_KEY = 'communityScriptsCatalogCacheV1';
const DETAILS_CACHE_KEY = 'communityScriptsDetailsCacheV1';
const GUIDE_CACHE_KEY = 'communityScriptsGuideCacheV1';
const DEFAULT_TTL_HOURS = 12;
const CACHE_SCHEMA_VERSION = 2;
const GITHUB_TREE_API = 'https://api.github.com/repos/community-scripts/ProxmoxVE/git/trees/main?recursive=1';
const RAW_BASE_URL = 'https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main';
const SUPPORTED_ROOTS = ['ct', 'vm', 'tools', 'turnkey'];
const ALLOWED_TOOLS_GROUPS = new Set(['addon', 'pve', 'copy-data']);
const SCRIPT_SLUG_OVERRIDES = {
  // future override map: '<path>': '<slug>'
};

function nowMs() {
  return Date.now();
}

function decodeEntities(text) {
  return (text || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function stripTags(text) {
  return (text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeType(rawType) {
  const value = (rawType || '').toString().toLowerCase();
  if (value.includes('vm')) return 'vm';
  if (value.includes('pve')) return 'pve';
  if (value.includes('addon')) return 'addon';
  if (value.includes('turnkey')) return 'turnkey';
  return 'ct';
}

function normalizeScriptRecord(record) {
  const slug = (record.slug || '').toString().trim();
  if (!slug) return null;
  const name = (record.name || slug).toString().trim();
  const description = (record.description || '').toString().trim() || `${name} script from community-scripts repository.`;
  const type = normalizeType(record.type);
  const installUrl = (record.installUrl || record.install_url || '').toString().trim() || null;
  const scriptPath = (record.path || record.scriptPath || '').toString().trim() || null;
  const toolsGroup = (record.toolsGroup || '').toString().trim().toLowerCase() || null;
  const uiGroup = (record.uiGroup || '').toString().trim().toLowerCase() || null;
  return { slug, name, description, type, installUrl, scriptPath, toolsGroup, uiGroup };
}

function parseJsonCatalog(payload) {
  const found = [];
  const seenObjects = new Set();
  const queue = [payload];

  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== 'object') continue;
    if (seenObjects.has(node)) continue;
    seenObjects.add(node);

    if (Array.isArray(node)) {
      node.forEach(item => queue.push(item));
      continue;
    }

    if (typeof node.slug === 'string' && node.slug.trim()) {
      found.push(node);
    }

    Object.values(node).forEach(value => {
      if (value && typeof value === 'object') queue.push(value);
    });
  }

  return found.map(normalizeScriptRecord).filter(Boolean);
}

function pathType(root) {
  if (root === 'vm') return 'vm';
  if (root === 'tools') return 'addon';
  if (root === 'turnkey') return 'turnkey';
  return 'ct';
}

function toDisplayName(slug) {
  return (slug || '')
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .trim() || slug;
}

function defaultDescription(name, type) {
  const label = type.toUpperCase();
  return `${name} (${label}) script from community-scripts repository.`;
}

function normalizeGitHubTree(tree) {
  const records = [];
  const slugCounts = new Map();
  const usedSlugs = new Set();

  for (const node of tree || []) {
    if (!node || node.type !== 'blob' || typeof node.path !== 'string') continue;
    const path = node.path;
    const parts = path.split('/');
    if (parts.length < 2) continue;
    const root = parts[0];
    if (!SUPPORTED_ROOTS.includes(root)) continue;
    const toolsGroup = root === 'tools' ? (parts[1] || '').toLowerCase() : null;
    if (root === 'tools' && !ALLOWED_TOOLS_GROUPS.has(toolsGroup)) {
      continue;
    }
    const fileName = parts[parts.length - 1];
    if (!fileName.endsWith('.sh')) continue;

    const baseSlug = (SCRIPT_SLUG_OVERRIDES[path] || fileName.replace(/\.sh$/, '')).trim();
    if (!baseSlug) continue;
    const count = slugCounts.get(baseSlug) || 0;
    slugCounts.set(baseSlug, count + 1);

    let slug = baseSlug;
    if (count > 0 || usedSlugs.has(slug)) {
      slug = `${baseSlug}-${root}`;
    }
    usedSlugs.add(slug);

    const type = pathType(root);
    const name = toDisplayName(baseSlug);
    const installUrl = `${RAW_BASE_URL}/${path}`;
    const uiGroup = root === 'ct' && /^alpine-[a-z0-9-]+\.sh$/i.test(fileName) ? 'lxc-alpine' : null;
    records.push({
      slug,
      name,
      type,
      description: defaultDescription(name, type),
      installUrl,
      scriptPath: path,
      toolsGroup,
      uiGroup
    });
  }

  return records.sort((a, b) => a.name.localeCompare(b.name));
}

export { parseJsonCatalog, normalizeGitHubTree };

async function getStorage(keys) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return {};
  return chrome.storage.local.get(keys);
}

async function setStorage(values) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  await chrome.storage.local.set(values);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      ...options.headers
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    credentials: 'omit',
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

function extractSectionByHeading(html, heading) {
  const safeHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingPattern = new RegExp(`<h2[^>]*>\\s*${safeHeading}\\s*<\\/h2>([\\s\\S]*?)(?=<h2[^>]*>|$)`, 'i');
  const match = html.match(headingPattern);
  if (!match) return '';
  return decodeEntities(stripTags(match[1]));
}

function extractSectionHtmlByHeading(html, heading) {
  const safeHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingPattern = new RegExp(`<h[23][^>]*>\\s*${safeHeading}\\s*<\\/h[23]>([\\s\\S]*?)(?=<h[23][^>]*>|$)`, 'i');
  const match = html.match(headingPattern);
  return match ? match[1] : '';
}

function detailsKeyForLabel(label) {
  const clean = (label || '').toString().trim().toLowerCase();
  if (!clean) return null;
  const map = {
    version: 'version',
    category: 'category',
    website: 'website',
    docs: 'docs',
    config: 'config',
    port: 'port',
    'runs in': 'runsIn',
    updated: 'updated'
  };
  return map[clean] || null;
}

function parseGuideDetails(sectionHtml) {
  if (!sectionHtml) return {};
  const details = {};
  const addPair = (label, value) => {
    const key = detailsKeyForLabel(label);
    const normalizedValue = decodeEntities(stripTags(value));
    if (!key || !normalizedValue) return;
    details[key] = normalizedValue;
  };

  const definitionPairs = sectionHtml.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi);
  for (const pair of definitionPairs) {
    addPair(pair[1], pair[2]);
  }

  const tablePairs = sectionHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi);
  for (const pair of tablePairs) {
    addPair(pair[1], pair[2]);
  }

  if (Object.keys(details).length > 0) return details;

  const labels = ['Version', 'Category', 'Website', 'Docs', 'Config', 'Port', 'Runs in', 'Updated'];
  labels.forEach(label => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escaped}\\s*<\\/[^>]+>\\s*<[^>]+>([\\s\\S]*?)<\\/[^>]+>`, 'i');
    const match = sectionHtml.match(pattern);
    if (match) addPair(label, match[1]);
  });

  return details;
}

function parseGuideInstallMethods(sectionHtml) {
  if (!sectionHtml) return [];
  const methods = [];
  const cards = [];
  const headingMatches = [...sectionHtml.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/gi)];

  if (headingMatches.length > 0) {
    for (let index = 0; index < headingMatches.length; index += 1) {
      const start = headingMatches[index].index || 0;
      const end = index + 1 < headingMatches.length ? (headingMatches[index + 1].index || sectionHtml.length) : sectionHtml.length;
      cards.push(sectionHtml.slice(start, end));
    }
  } else {
    cards.push(sectionHtml);
  }

  const extractMetric = (text, label) => {
    const beforeLabelPattern = new RegExp(`([0-9]+)\\s*${label}`, 'i');
    const afterLabelPattern = new RegExp(`${label}\\s*[:]?\\s*([0-9]+)`, 'i');
    const match = text.match(beforeLabelPattern) || text.match(afterLabelPattern);
    return match ? match[1] : '';
  };

  cards.forEach(cardHtml => {
    const nameMatch = cardHtml.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
    const text = decodeEntities(stripTags(cardHtml));
    const name = decodeEntities(stripTags(nameMatch ? nameMatch[1] : '')).toLowerCase() || '';
    if (!name) return;

    const entry = {
      name,
      os: '',
      cpu: extractMetric(text, 'CPU'),
      ram: extractMetric(text, 'RAM'),
      hdd: extractMetric(text, 'HDD')
    };

    const osMatch = text.match(/\b(debian|ubuntu|alpine|arch|fedora)\b[^0-9]?\s*([0-9]+)?/i);
    if (osMatch) {
      entry.os = `${osMatch[1]}${osMatch[2] ? ` ${osMatch[2]}` : ''}`.trim();
    }
    methods.push(entry);
  });

  return methods;
}

function parseGuideFromHtml(html, slug) {
  const about = extractSectionByHeading(html, 'About');
  const notes = extractSectionByHeading(html, 'Notes');
  const installMatch = html.match(/bash\s+-c\s+"?\$\(curl\s+-fsSL\s+(https:\/\/raw\.githubusercontent\.com\/community-scripts\/ProxmoxVE\/main\/[a-z0-9/_-]+\.sh)\)"?/i);
  const detailsHtml = extractSectionHtmlByHeading(html, 'Details');
  const installMethodsHtml = extractSectionHtmlByHeading(html, 'Install methods');
  return {
    slug,
    about,
    notes,
    installCommand: installMatch ? `bash -c "$(curl -fsSL ${installMatch[1]})"` : '',
    details: parseGuideDetails(detailsHtml),
    installMethods: parseGuideInstallMethods(installMethodsHtml)
  };
}

async function fetchGitHubCatalog(fetchImpl = fetchJson) {
  const payload = await fetchImpl(GITHUB_TREE_API, {
    headers: { 'X-GitHub-Api-Version': '2022-11-28' }
  });
  const tree = Array.isArray(payload?.tree) ? payload.tree : [];
  const scripts = normalizeGitHubTree(tree);
  if (!scripts.length) {
    throw new Error('GitHub tree returned no supported scripts.');
  }
  return { source: 'github', scripts };
}

function isFresh(timestamp, ttlHours) {
  if (!timestamp) return false;
  const ttlMs = Math.max(1, Number(ttlHours || DEFAULT_TTL_HOURS)) * 60 * 60 * 1000;
  return nowMs() - Number(timestamp) < ttlMs;
}

function inferTypeFromInstallUrl(url) {
  if (!url) return 'ct';
  if (url.includes('/vm/')) return 'vm';
  if (url.includes('/tools/')) return 'addon';
  if (url.includes('/turnkey/')) return 'turnkey';
  return 'ct';
}

export async function getCommunityScriptsCatalog(options = {}) {
  const forceRefresh = Boolean(options.forceRefresh);
  const ttlHours = Number(options.ttlHours || DEFAULT_TTL_HOURS);

  if (!forceRefresh) {
    const cache = await getStorage([CATALOG_CACHE_KEY]);
    const cached = cache[CATALOG_CACHE_KEY];
    if (cached && Array.isArray(cached.scripts) && isFresh(cached.updatedAt, ttlHours)) {
      return { source: cached.source || 'cache', scripts: cached.scripts };
    }
  }

  try {
    const catalog = await fetchGitHubCatalog();
    await setStorage({
      [CATALOG_CACHE_KEY]: {
        source: catalog.source,
        scripts: catalog.scripts,
        updatedAt: nowMs(),
        schemaVersion: CACHE_SCHEMA_VERSION
      }
    });
    return catalog;
  } catch (error) {
    const cache = await getStorage([CATALOG_CACHE_KEY]);
    const cached = cache[CATALOG_CACHE_KEY];
    if (cached && Array.isArray(cached.scripts) && cached.scripts.length) {
      return {
        source: 'cache-fallback',
        scripts: cached.scripts,
        stale: true,
        warning: error.message
      };
    }
    throw error;
  }
}

export async function __testFetchCatalogFromEndpoints(endpoints, fetchImpl) {
  for (const endpoint of endpoints || []) {
    try {
      const payload = await fetchImpl(endpoint);
      const parsed = parseJsonCatalog(payload);
      if (parsed.length > 0) {
        return { source: endpoint, scripts: parsed };
      }
    } catch (_error) {
      // continue
    }
  }
  return null;
}

export async function __testFetchGitHubCatalog(fetchImpl) {
  return fetchGitHubCatalog(fetchImpl);
}

export function __testParseGuideFromHtml(html, slug = 'test') {
  return parseGuideFromHtml(html, slug);
}

export async function getCommunityScriptDetails(slug, options = {}) {
  const cleanSlug = (slug || '').toString().trim();
  if (!cleanSlug) {
    throw new Error('Missing script slug.');
  }

  const forceRefresh = Boolean(options.forceRefresh);
  const ttlHours = Number(options.ttlHours || DEFAULT_TTL_HOURS);
  const storage = await getStorage([DETAILS_CACHE_KEY]);
  const detailsMap = storage[DETAILS_CACHE_KEY] || {};
  const cached = detailsMap[cleanSlug];

  if (!forceRefresh && cached && isFresh(cached.updatedAt, ttlHours)) {
    return cached;
  }

  const catalog = await getCommunityScriptsCatalog({ ttlHours, forceRefresh: false });
  const fromCatalog = (catalog.scripts || []).find(entry => entry.slug === cleanSlug);

  const details = {
    slug: cleanSlug,
    name: fromCatalog?.name || cached?.name || cleanSlug,
    description: fromCatalog?.description || cached?.description || `${cleanSlug} script.`,
    installUrl: fromCatalog?.installUrl || cached?.installUrl || null,
    scriptPath: fromCatalog?.scriptPath || cached?.scriptPath || null,
    type: fromCatalog?.type || inferTypeFromInstallUrl(fromCatalog?.installUrl || cached?.installUrl || null),
    updatedAt: nowMs()
  };

  detailsMap[cleanSlug] = details;
  await setStorage({ [DETAILS_CACHE_KEY]: detailsMap });
  return details;
}

export async function getCommunityScriptGuide(slug, options = {}) {
  const cleanSlug = (slug || '').toString().trim();
  if (!cleanSlug) {
    throw new Error('Missing script slug for guide.');
  }

  const forceRefresh = Boolean(options.forceRefresh);
  const ttlHours = Number(options.ttlHours || DEFAULT_TTL_HOURS);
  const pageUrl = `https://community-scripts.org/scripts/${encodeURIComponent(cleanSlug)}`;
  const storage = await getStorage([GUIDE_CACHE_KEY]);
  const guideMap = storage[GUIDE_CACHE_KEY] || {};
  const cached = guideMap[cleanSlug];
  if (!forceRefresh && cached && isFresh(cached.updatedAt, ttlHours)) {
    return cached;
  }

  try {
    const html = await fetchText(pageUrl);
    const parsed = parseGuideFromHtml(html, cleanSlug);
    const guide = {
      slug: cleanSlug,
      pageUrl,
      about: parsed.about || '',
      notes: parsed.notes || '',
      installCommand: parsed.installCommand || '',
      details: parsed.details || {},
      installMethods: Array.isArray(parsed.installMethods) ? parsed.installMethods : [],
      updatedAt: nowMs()
    };
    guideMap[cleanSlug] = guide;
    await setStorage({ [GUIDE_CACHE_KEY]: guideMap });
    return guide;
  } catch (_error) {
    if (cached) {
      return {
        ...cached,
        pageUrl,
        details: cached.details || {},
        installMethods: Array.isArray(cached.installMethods) ? cached.installMethods : [],
        stale: true
      };
    }
    return {
      slug: cleanSlug,
      pageUrl,
      about: '',
      notes: '',
      installCommand: '',
      details: {},
      installMethods: [],
      stale: true,
      updatedAt: nowMs()
    };
  }
}
