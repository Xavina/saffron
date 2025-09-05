// Simple in-memory health history tracking - only state changes
let healthHistory = [];
const MAX_HISTORY_ENTRIES = 3;

export default async function handler(req, res) {
    if (req.method === 'GET') {
        return res.status(200).json({ history: healthHistory });
    }

    if (req.method === 'POST') {
        const { connected, responseTime, timestamp } = req.body;
        const newConnectedState = !!connected;
        
        // Only add entry if:
        // 1. This is the first entry (initial connection state)
        // 2. The connection state has changed from the previous entry
        const lastEntry = healthHistory[0];
        const shouldAddEntry = !lastEntry || lastEntry.connected !== newConnectedState;
        
        if (shouldAddEntry) {
            healthHistory.unshift({
                connected: newConnectedState,
                responseTime: responseTime || null,
                timestamp: timestamp || new Date().toISOString(),
                id: Date.now(),
                type: !lastEntry ? 'initial' : (newConnectedState ? 'reconnected' : 'disconnected')
            });

            // Keep only the most recent entries
            if (healthHistory.length > MAX_HISTORY_ENTRIES) {
                healthHistory = healthHistory.slice(0, MAX_HISTORY_ENTRIES);
            }
        }

        return res.status(200).json({ success: true, added: shouldAddEntry });
    }

    return res.status(405).json({ message: 'Method not allowed' });
}