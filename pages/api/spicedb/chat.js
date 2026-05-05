import {
    handleSpiceDbAssistantMessage,
    mapAssistantError,
} from '../../../lib/copilot/spicedbAssistant';
import { isAssistantEnabled } from '../../../lib/assistantFeature';

export default async function handler(req, res) {
    if (!isAssistantEnabled()) {
        return res.status(404).json({ message: 'Not found' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const response = await handleSpiceDbAssistantMessage(req.body?.message, {
            sessionId: req.body?.sessionId,
            conversationId: req.body?.conversationId,
        });
        return res.status(200).json(response);
    } catch (error) {
        console.error('Chat assistant API error:', error);
        const mapped = mapAssistantError(error);
        return res.status(mapped.statusCode).json(mapped.body);
    }
}