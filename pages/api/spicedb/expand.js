import { v1 } from '@authzed/authzed-node';
import { getSpiceDbPromiseClient, mapGrpcError, toObjectReference } from '../../../lib/spicedb';

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

        const client = getSpiceDbPromiseClient();
        const request = v1.ExpandPermissionTreeRequest.create({
            resource: toObjectReference(resource),
            permission,
        });

        const data = await client.expandPermissionTree(request);
        res.status(200).json(data);

    } catch (error) {
        console.error('Expand API error:', error);
        res.status(500).json({
            message: mapGrpcError(error).message,
            error: error.message,
            code: error.code,
        });
    }
}