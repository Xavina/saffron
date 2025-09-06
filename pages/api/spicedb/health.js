export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const spicedbUrl = process.env.SPICEDB_URL || 'http://localhost:8080';
    const token = process.env.SPICEDB_TOKEN || 'somerandomkeyhere';

    try {
        const startTime = Date.now();

        // Test basic connectivity with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
        
        const response = await fetch(`${spicedbUrl}/healthz`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));

        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const timestamp = new Date().toISOString();
        const connected = response.ok;

        // Record health state change
        try {
            await fetch(`http://localhost:${process.env.PORT || 3000}/api/spicedb/health-history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    connected,
                    responseTime,
                    timestamp
                })
            });
        } catch (e) {
            // Ignore history tracking errors
        }

        if (response.ok) {
            res.status(200).json({
                status: 'healthy',
                connected: true,
                responseTime: `${responseTime}ms`,
                spicedbUrl: spicedbUrl,
                timestamp: timestamp
            });
        } else {
            const errorText = await response.text();
            res.status(200).json({
                status: 'unhealthy',
                connected: false,
                error: `HTTP ${response.status}: ${errorText}`,
                responseTime: `${responseTime}ms`,
                spicedbUrl: spicedbUrl,
                timestamp: timestamp
            });
        }

    } catch (error) {
        const timestamp = new Date().toISOString();
        
        // Record health state change
        try {
            await fetch(`http://localhost:${process.env.PORT || 3000}/api/spicedb/health-history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    connected: false,
                    responseTime: null,
                    timestamp
                })
            });
        } catch (e) {
            // Ignore history tracking errors
        }

        res.status(200).json({
            status: 'unhealthy',
            connected: false,
            error: error.message,
            spicedbUrl: spicedbUrl,
            timestamp: timestamp
        });
    }
}