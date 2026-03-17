export const UI_SCALE_MIN = 85;
export const UI_SCALE_MAX = 140;
export const UI_SCALE_DEFAULT = 100;

export const UI_SCALE_PRESETS = Object.freeze({
    compact: 90,
    standard: 100,
    large: 115
});

export function normalizeUiScale(value, fallback = UI_SCALE_DEFAULT) {
    const numeric = Number.isFinite(Number(value)) ? Number(value) : Number(fallback);
    if (!Number.isFinite(numeric)) return UI_SCALE_DEFAULT;
    const rounded = Math.round(numeric);
    return Math.max(UI_SCALE_MIN, Math.min(UI_SCALE_MAX, rounded));
}

export function getUiScalePresetId(value) {
    const normalized = normalizeUiScale(value);
    if (normalized === UI_SCALE_PRESETS.compact) return 'compact';
    if (normalized === UI_SCALE_PRESETS.standard) return 'standard';
    if (normalized === UI_SCALE_PRESETS.large) return 'large';
    return 'custom';
}

export function resolveUiScalePresetValue(presetId, fallback = UI_SCALE_DEFAULT) {
    if (presetId === 'compact') return UI_SCALE_PRESETS.compact;
    if (presetId === 'standard') return UI_SCALE_PRESETS.standard;
    if (presetId === 'large') return UI_SCALE_PRESETS.large;
    return normalizeUiScale(fallback);
}

export function toUiScaleFactor(value) {
    const normalized = normalizeUiScale(value);
    return String(normalized / 100);
}
