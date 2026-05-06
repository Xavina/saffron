import { checkSpiceDbGrpcHealth, getSpiceDbEndpoint } from '../../../lib/spicedb';

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
    try {
        const startTime = Date.now();

        const grpcHealth = await withTimeout(
            checkSpiceDbGrpcHealth({ timeoutMs: 1500 }),
            2100,
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
            healthProbe: grpcHealth.probe,
            grpcProbeResult: grpcHealth.result,
            grpcProbeLatencyMs: grpcHealth.latencyMs,
            ...(grpcHealth.grpcCode !== undefined ? { grpcCode: grpcHealth.grpcCode } : {}),
            ...(grpcHealth.grpcMessage ? { grpcMessage: grpcHealth.grpcMessage } : {}),
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
            healthProbe: 'grpc-checkPermission',
            timestamp,
        });
    }
}
