// Simple in-memory health history tracking - only state changes
// This will persist for the duration of the server running
let healthHistory = [];
const MAX_HISTORY_ENTRIES = 5;
let lastKnownState = null;

export default async function handler(req, res) {
    if (req.method === 'GET') {
        return res.status(200).json({ history: healthHistory });
    }

    if (req.method === 'POST') {
        const { connected, responseTime, timestamp } = req.body;
        const newConnectedState = !!connected;
        
        // Determine if state has changed
        const hasStateChanged = lastKnownState === null || lastKnownState !== newConnectedState;
        
        if (hasStateChanged) {
            // Determine type based on history
            let type = 'initial';
            if (lastKnownState !== null) {
                type = newConnectedState ? 'reconnected' : 'disconnected';
            }
            
            healthHistory.unshift({
                connected: newConnectedState,
                responseTime: responseTime || null,
                timestamp: timestamp || new Date().toISOString(),
                id: Date.now(),
                type: type
            });

            // Update last known state
            lastKnownState = newConnectedState;

            // Keep only the most recent entries
            if (healthHistory.length > MAX_HISTORY_ENTRIES) {
                healthHistory = healthHistory.slice(0, MAX_HISTORY_ENTRIES);
            }
        }

        return res.status(200).json({ success: true, added: hasStateChanged });
    }

    return res.status(405).json({ message: 'Method not allowed' });
}