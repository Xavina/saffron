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

function isLocalHostname(hostname) {
    return hostname === 'localhost'
        || hostname === '127.0.0.1'
        || hostname === '0.0.0.0'
        || hostname === 'spicedb';
}

export function getSpiceDbVersionUrl() {
    const explicitVersionEndpoint = process.env.SPICEDB_VERSION_ENDPOINT;
    if (explicitVersionEndpoint) {
        return explicitVersionEndpoint;
    }

    const rawEndpoint = process.env.SPICEDB_ENDPOINT || 'localhost:50051';

    if (rawEndpoint.startsWith('http://') || rawEndpoint.startsWith('https://')) {
        try {
            const url = new URL(rawEndpoint);
            url.pathname = '/version';
            url.search = '';
            url.hash = '';
            return url.toString();
        } catch {
            return `${rawEndpoint.replace(/\/+$/, '')}/version`;
        }
    }

    const endpoint = getSpiceDbEndpoint();
    const [host, port] = endpoint.split(':');
    const mappedPort = !port || port === '50051' ? '8443' : port;
    const protocol = isLocalHostname(host) ? 'http' : 'https';

    return `${protocol}://${host}:${mappedPort}/version`;
}

export async function checkSpiceDbVersion(options = {}) {
    const timeoutMs = Number(options.timeoutMs || 2000);
    const versionUrl = getSpiceDbVersionUrl();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(versionUrl, {
            method: 'GET',
            headers: {
                Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
            },
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`Version endpoint returned HTTP ${response.status}`);
        }

        const payload = await response.text();
        const trimmed = payload.trim();
        let version = trimmed;

        if (trimmed.startsWith('{')) {
            try {
                const parsed = JSON.parse(trimmed);
                version = parsed.version || parsed.tag || parsed.build || trimmed;
            } catch {
                version = trimmed;
            }
        }

        return {
            connected: true,
            version: version || 'unknown',
            versionUrl,
        };
    } finally {
        clearTimeout(timeoutHandle);
    }
}

function isGrpcTransportError(error) {
    const code = Number(error?.code);
    if (code === 14 || code === 4 || code === 1) {
        return true;
    }

    const message = String(error?.details || error?.message || '').toLowerCase();
    return message.includes('unavailable')
        || message.includes('deadline')
        || message.includes('timed out')
        || message.includes('timeout')
        || message.includes('econnrefused')
        || message.includes('connect')
        || message.includes('socket');
}

export async function checkSpiceDbGrpcHealth(options = {}) {
    const timeoutMs = Number(options.timeoutMs || 1500);
    const client = getSpiceDbPromiseClient();
    const startedAt = Date.now();

    const request = v1.CheckPermissionRequest.create({
        resource: v1.ObjectReference.create({
            objectType: '__healthcheck__',
            objectId: 'ping',
        }),
        permission: '__healthcheck__',
        subject: v1.SubjectReference.create({
            object: v1.ObjectReference.create({
                objectType: '__healthcheck__',
                objectId: 'ping',
            }),
        }),
    });

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
        await Promise.race([
            client.checkPermission(request),
            timeoutPromise,
        ]);

        return {
            connected: true,
            probe: 'grpc-checkPermission',
            latencyMs: Date.now() - startedAt,
            result: 'ok',
        };
    } catch (error) {
        if (isGrpcTransportError(error)) {
            throw error;
        }

        return {
            connected: true,
            probe: 'grpc-checkPermission',
            latencyMs: Date.now() - startedAt,
            result: 'server-responded-with-application-error',
            grpcCode: error?.code,
            grpcMessage: error?.details || error?.message || 'gRPC error',
        };
    }
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
