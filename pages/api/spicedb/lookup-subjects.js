export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { resource, permission, subjectObjectType } = req.body;

        if (!resource || !permission || !subjectObjectType) {
            return res.status(400).json({
                message: 'Missing required fields: resource, permission, subjectObjectType'
            });
        }

        const spicedbUrl = process.env.SPICEDB_URL || 'http://localhost:8080';
        const token = process.env.SPICEDB_TOKEN || 'somerandomkeyhere';

        const response = await fetch(`${spicedbUrl}/v1/permissions/subjects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                resource,
                permission,
                subjectObjectType
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({
                message: `SpiceDB error: ${errorText}`
            });
        }

        const subjects = [];

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            let boundary = buffer.lastIndexOf('\n');

            if (boundary !== -1) {
                const chunks = buffer.slice(0, boundary).split('\n');
                buffer = buffer.slice(boundary + 1);

                for (const chunk of chunks) {
                    if (chunk.trim() === '') continue;

                    try {
                        const parsed = JSON.parse(chunk);
                        if (parsed.result && parsed.result.subject) {
                            subjects.push(parsed.result.subject);
                        }
                    } catch (e) {
                        console.error('Failed to parse chunk:', chunk, e);
                    }
                }
            }
        }

        res.status(200).json({ subjects });

    } catch (error) {
        console.error('Lookup subjects API error:', error);
        res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }
}
