import { v1 } from '@authzed/authzed-node';
import { getSpiceDbPromiseClient, mapGrpcError } from '../../../lib/spicedb';

export default async function handler(req, res) {
    const client = getSpiceDbPromiseClient();

    if (req.method === 'GET') {
        try {
            const data = await client.readSchema(v1.ReadSchemaRequest.create({}));
            // Return the schema text
            res.status(200).send(data.schemaText || '');

        } catch (error) {
            console.error('Schema read API error:', error);
            res.status(500).json({
                message: mapGrpcError(error).message,
                error: error.message,
                code: error.code,
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

            const data = await client.writeSchema(v1.WriteSchemaRequest.create({ schema: schemaText }));
            res.status(200).json(data);

        } catch (error) {
            console.error('Schema write API error:', error);
            res.status(500).json({
                message: mapGrpcError(error).message,
                error: error.message,
                code: error.code,
            });
        }
    }
    else {
        res.status(405).json({ message: 'Method not allowed' });
    }
}