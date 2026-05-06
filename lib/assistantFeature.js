function asBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    const normalized = String(value).trim().toLowerCase();

    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
        return true;
    }

    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
        return false;
    }

    return fallback;
}

export const ASSISTANT_FEATURE_FLAG = 'NEXT_PUBLIC_ENABLE_ASSISTANT';

const assistantFeatureEnabled = asBoolean(process.env.NEXT_PUBLIC_ENABLE_ASSISTANT, false);

export function isAssistantEnabled() {
    return assistantFeatureEnabled;
}
