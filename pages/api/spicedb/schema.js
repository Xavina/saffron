export default async function handler(req, res) {
    const spicedbUrl = process.env.SPICEDB_URL || 'http://localhost:8080';
    const token = process.env.SPICEDB_TOKEN || 'somerandomkeyhere';

    if (req.method === 'GET') {
        try {
            const response = await fetch(`${spicedbUrl}/v1/schema/read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('SpiceDB schema read error:', response.status, errorText);
                return res.status(response.status).json({
                    message: `SpiceDB error: ${errorText}`
                });
            }

            const data = await response.json();
            // Return the schema text
            res.status(200).send(data.schemaText || '');

        } catch (error) {
            console.error('Schema read API error:', error);
            res.status(500).json({
                message: 'Internal server error',
                error: error.message
            });
        }
    }
    else if (req.method === 'POST') {
        try {
            // Get the raw body as text
            let schemaText = '';

            if (typeof req.body === 'string') {
                schemaText = req.body;
            } else if (req.body && typeof req.body === 'object') {
                // If it's already parsed as JSON, convert back to string
                schemaText = JSON.stringify(req.body);
            }

            console.log('Writing schema:', schemaText);

            const response = await fetch(`${spicedbUrl}/v1/schema/write`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    schema: schemaText
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('SpiceDB schema write error:', response.status, errorText);
                return res.status(response.status).json({
                    message: `SpiceDB error: ${errorText}`
                });
            }

            const data = await response.json();
            res.status(200).json(data);

        } catch (error) {
            console.error('Schema write API error:', error);
            res.status(500).json({
                message: 'Internal server error',
                error: error.message
            });
        }
    }
    else {
        res.status(405).json({ message: 'Method not allowed' });
    }
}