import { v1 } from '@authzed/authzed-node';
import { getSpiceDbEndpoint, getSpiceDbPromiseClient } from '../../../lib/spicedb';

function withTimeout(promise, timeoutMs) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
        }),
    ]);
}

async function recordHealth(connected, responseTime, timestamp) {
    try {
        await fetch(`http://localhost:${process.env.PORT || 3000}/api/spicedb/health-history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                connected,
                responseTime,
                timestamp,
            }),
        });
    } catch {
        // Ignore history tracking errors.
    }
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const spicedbEndpoint = getSpiceDbEndpoint();
    const client = getSpiceDbPromiseClient();

    try {
        const startTime = Date.now();

        await withTimeout(
            client.readSchema(v1.ReadSchemaRequest.create({})),
            2000,
        );

        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const timestamp = new Date().toISOString();

        await recordHealth(true, responseTime, timestamp);

        return res.status(200).json({
            status: 'healthy',
            connected: true,
            responseTime: `${responseTime}ms`,
            spicedbEndpoint,
            timestamp,
        });
    } catch (error) {
        const timestamp = new Date().toISOString();
        await recordHealth(false, null, timestamp);

        return res.status(200).json({
            status: 'unhealthy',
            connected: false,
            error: error.message,
            spicedbEndpoint,
            timestamp,
        });
    }
}
