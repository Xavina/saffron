import { v1 } from '@authzed/authzed-node';
import { getSpiceDbPromiseClient, mapGrpcError, toObjectReference, toStruct, toSubjectReference } from '../../../lib/spicedb';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { resource, permission, subject, context, withTracing } = req.body;

        // Validate required fields
        if (!resource || !permission || !subject) {
            return res.status(400).json({
                message: 'Missing required fields: resource, permission, subject'
            });
        }

        const client = getSpiceDbPromiseClient();
        const request = v1.CheckPermissionRequest.create({
            resource: toObjectReference(resource),
            permission,
            subject: toSubjectReference(subject),
            ...(context && { context: toStruct(context) }),
            ...(withTracing && { withTracing: true }),
        });

        const data = await client.checkPermission(request);
        res.status(200).json(data);

    } catch (error) {
        console.error('Check API error:', error);
        res.status(500).json({
            message: mapGrpcError(error).message,
            error: error.message,
            code: error.code,
        });
    }
}