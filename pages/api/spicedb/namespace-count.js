import { v1 } from '@authzed/authzed-node';
import { getSpiceDbPromiseClient } from '../../../lib/spicedb';

const PAGE_SIZE = 1000;
const PAGE_TIMEOUT_MS = 10000;
const TOTAL_TIMEOUT_MS = 120000;
const MAX_PAGE_RETRIES = 3;
const RETRY_BACKOFF_MS = 250;

function withTimeout(promise, timeoutMs) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs),
        ),
    ]);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientReadError(error) {
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
        || message.includes('socket')
        || message.includes('connect');
}

async function readRelationshipsPageWithRetry(client, request, deadline) {
    let attempt = 0;
    while (true) {
        try {
            return await withTimeout(
                client.readRelationships(request),
                PAGE_TIMEOUT_MS,
            );
        } catch (error) {
            const retriesExhausted = attempt >= MAX_PAGE_RETRIES;
            const outOfTime = Date.now() >= deadline;

            if (!isTransientReadError(error) || retriesExhausted || outOfTime) {
                throw error;
            }

            const backoffMs = RETRY_BACKOFF_MS * (2 ** attempt);
            attempt += 1;
            await sleep(backoffMs);
        }
    }
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { namespace } = req.query;
    if (!namespace || typeof namespace !== 'string') {
        return res.status(400).json({ message: 'namespace query parameter is required' });
    }

    const client = getSpiceDbPromiseClient();
    const deadline = Date.now() + TOTAL_TIMEOUT_MS;

    const uniqueSubjects = new Set();
    const subjectTypes = new Set();
    let relationshipCount = 0;
    let cursorToken = null;

    try {

        do {
            if (Date.now() > deadline) {
                return res.status(200).json({
                    namespace,
                    relationshipCount,
                    subjectCount: uniqueSubjects.size,
                    subjectTypes: Array.from(subjectTypes),
                    isApproximate: true,
                    timedOut: true,
                });
            }

            const response = await readRelationshipsPageWithRetry(
                client,
                v1.ReadRelationshipsRequest.create({
                    relationshipFilter: v1.RelationshipFilter.create({ resourceType: namespace }),
                    optionalLimit: PAGE_SIZE,
                    ...(cursorToken ? { optionalCursor: v1.Cursor.create({ token: cursorToken }) } : {}),
                }),
                deadline,
            );

            const relationships = response.map((item) => item.relationship).filter(Boolean);
            relationshipCount += relationships.length;

            relationships.forEach((rel) => {
                if (rel.subject?.object) {
                    uniqueSubjects.add(`${rel.subject.object.objectType}:${rel.subject.object.objectId}`);
                    subjectTypes.add(rel.subject.object.objectType);
                }
            });

            cursorToken = response.at(-1)?.afterResultCursor?.token || null;
        } while (cursorToken);

        return res.status(200).json({
            namespace,
            relationshipCount,
            subjectCount: uniqueSubjects.size,
            subjectTypes: Array.from(subjectTypes),
            isApproximate: false,
            timedOut: false,
        });
    } catch (error) {
        console.error(`Error counting relationships for ${namespace}:`, error);

        if (isTransientReadError(error)) {
            return res.status(200).json({
                namespace,
                relationshipCount,
                subjectCount: uniqueSubjects.size,
                subjectTypes: Array.from(subjectTypes),
                isApproximate: true,
                timedOut: true,
                partial: true,
                transientError: true,
            });
        }

        return res.status(500).json({ message: 'Failed to count relationships', error: error.message });
    }
}
