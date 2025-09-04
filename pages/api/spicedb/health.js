export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const spicedbUrl = process.env.SPICEDB_URL || 'http://localhost:8080';
    const token = process.env.SPICEDB_TOKEN || 'somerandomkeyhere';

    try {
        const startTime = Date.now();

        // Test basic connectivity with schema read
        const response = await fetch(`${spicedbUrl}/healthz`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            }
        });

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        if (response.ok) {
            res.status(200).json({
                status: 'healthy',
                connected: true,
                responseTime: `${responseTime}ms`,
                spicedbUrl: spicedbUrl,
                timestamp: new Date().toISOString()
            });
        } else {
            const errorText = await response.text();
            res.status(200).json({
                status: 'unhealthy',
                connected: false,
                error: `HTTP ${response.status}: ${errorText}`,
                responseTime: `${responseTime}ms`,
                spicedbUrl: spicedbUrl,
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        res.status(200).json({
            status: 'unhealthy',
            connected: false,
            error: error.message,
            spicedbUrl: spicedbUrl,
            timestamp: new Date().toISOString()
        });
    }
}