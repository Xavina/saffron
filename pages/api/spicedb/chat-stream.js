import {
    mapAssistantError,
    streamSpiceDbAssistantMessage,
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
        await streamSpiceDbAssistantMessage(req.body?.message, {
            sessionId: req.body?.sessionId,
            conversationId: req.body?.conversationId,
        }, {
            onReady: ({ sessionId, conversationId }) => {
                res.writeHead(200, {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Cache-Control': 'no-cache, no-transform',
                    Connection: 'keep-alive',
                    'X-Accel-Buffering': 'no',
                    'X-Copilot-Session-Id': sessionId || '',
                    'X-Copilot-Conversation-Id': conversationId || '',
                });
            },
            onDelta: (delta) => {
                if (delta && !res.writableEnded) {
                    res.write(delta);
                }
            },
        });

        if (!res.writableEnded) {
            res.end();
        }
    } catch (error) {
        console.error('Assistant streaming API error:', error);
        const mapped = mapAssistantError(error);

        if (res.headersSent) {
            if (!res.writableEnded) {
                res.end(`\n\nAssistant error: ${mapped.body.message}`);
            }
            return;
        }

        return res.status(mapped.statusCode).json(mapped.body);
    }
}