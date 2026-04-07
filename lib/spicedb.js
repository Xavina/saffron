import { v1 } from '@authzed/authzed-node';

let cachedClient = null;

function asBoolean(value, fallback) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
        return false;
    }

    return fallback;
}

function normalizeEndpoint(rawEndpoint) {
    if (!rawEndpoint) {
        return 'localhost:50051';
    }

    if (rawEndpoint.startsWith('http://') || rawEndpoint.startsWith('https://')) {
        try {
            const explicitPortMatch = rawEndpoint.match(/^[a-z]+:\/\/[^/]+:(\d+)(?:\/|$)/i);
            const url = new URL(rawEndpoint);
            const port = explicitPortMatch?.[1] || url.port;

            if (!port) {
                if (url.protocol === 'https:') {
                    return `${url.hostname}:443`;
                }
                return `${url.hostname}:50051`;
            }

            if (port === '8443') {
                return `${url.hostname}:50051`;
            }

            return `${url.hostname}:${port}`;
        } catch {
            return rawEndpoint;
        }
    }

    return rawEndpoint;
}

function getSecurityMode(endpoint) {
    const explicitInsecure = process.env.SPICEDB_INSECURE;
    if (explicitInsecure !== undefined) {
        return asBoolean(explicitInsecure, false)
            ? v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS
            : v1.ClientSecurity.SECURE;
    }

    if (endpoint.startsWith('localhost:') || endpoint.startsWith('127.0.0.1:') || endpoint.startsWith('spicedb:')) {
        return v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS;
    }

    return v1.ClientSecurity.SECURE;
}

export function getSpiceDbEndpoint() {
    const raw = process.env.SPICEDB_ENDPOINT || 'localhost:50051';
    return normalizeEndpoint(raw);
}

export function getSpiceDbToken() {
    return process.env.SPICEDB_PRESHARED_KEY || process.env.SPICEDB_TOKEN || 'somerandomkeyhere';
}

export function getSpiceDbClient() {
    if (cachedClient) {
        return cachedClient;
    }

    const endpoint = getSpiceDbEndpoint();
    const securityMode = getSecurityMode(endpoint);

    cachedClient = v1.NewClient(getSpiceDbToken(), endpoint, securityMode);
    return cachedClient;
}

export function getSpiceDbPromiseClient() {
    return getSpiceDbClient().promises;
}

export function toObjectReference(input) {
    if (!input) {
        return undefined;
    }

    const objectType = input.objectType || input.object_type;
    const objectId = input.objectId || input.object_id;

    if (!objectType || !objectId) {
        return undefined;
    }

    return v1.ObjectReference.create({ objectType, objectId });
}

export function toSubjectReference(input) {
    if (!input) {
        return undefined;
    }

    const objectRef = toObjectReference(input.object || input);
    if (!objectRef) {
        return undefined;
    }

    const optionalRelation = input.optionalRelation || input.optional_relation || '';

    return v1.SubjectReference.create({
        object: objectRef,
        optionalRelation,
    });
}

export function toStruct(input) {
    if (!input || typeof input !== 'object') {
        return undefined;
    }

    return v1.PbStruct.fromJson(input);
}

export function mapGrpcError(error) {
    return {
        message: error?.details || error?.message || 'SpiceDB gRPC request failed',
        code: error?.code,
    };
}
