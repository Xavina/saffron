export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { resource, permission, context } = req.body;

        // Validate required fields
        if (!resource || !permission) {
            return res.status(400).json({
                message: 'Missing required fields: resource, permission'
            });
        }

        // SpiceDB API endpoint - adjust URL as needed
        const spicedbUrl = process.env.SPICEDB_URL || 'http://localhost:8080';
        const token = process.env.SPICEDB_TOKEN || 'somerandomkeyhere';

        const requestBody = {
            resource,
            permission,
            ...(context && { context })
        };

        const response = await fetch(`${spicedbUrl}/v1/permissions/expand`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({
                message: `SpiceDB error: ${errorText}`
            });
        }

        const data = await response.json();
        res.status(200).json(data);

    } catch (error) {
        console.error('Expand API error:', error);
        res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }
}