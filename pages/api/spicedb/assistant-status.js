import {
    getSpiceDbAssistantStatus,
    mapAssistantError,
} from '../../../lib/copilot/spicedbAssistant';
import { isAssistantEnabled } from '../../../lib/assistantFeature';

export default async function handler(req, res) {
    if (!isAssistantEnabled()) {
        return res.status(404).json({ message: 'Not found' });
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const status = await getSpiceDbAssistantStatus();
        return res.status(status.ready ? 200 : 503).json(status);
    } catch (error) {
        console.error('Assistant status API error:', error);
        const mapped = mapAssistantError(error);
        return res.status(mapped.statusCode).json(mapped.body);
    }
}