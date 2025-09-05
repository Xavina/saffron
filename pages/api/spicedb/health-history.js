import fs from 'fs';
import path from 'path';

// File-based persistence for health history
const HISTORY_FILE = path.join(process.cwd(), '.health-history.json');
const MAX_HISTORY_ENTRIES = 5;

// Load history from file on startup
function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading health history:', error);
    }
    return { history: [], lastKnownState: null };
}

// Save history to file
function saveHistory(history, lastKnownState) {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify({ history, lastKnownState }, null, 2));
    } catch (error) {
        console.error('Error saving health history:', error);
    }
}

export default async function handler(req, res) {
    // Load current state from file
    const { history: currentHistory, lastKnownState: currentLastState } = loadHistory();
    
    if (req.method === 'GET') {
        return res.status(200).json({ history: currentHistory });
    }

    if (req.method === 'POST') {
        const { connected, responseTime, timestamp } = req.body;
        const newConnectedState = !!connected;
        
        // Check if state has actually changed
        const hasStateChanged = currentLastState === null || currentLastState !== newConnectedState;
        
        if (hasStateChanged) {
            // Determine the type of change
            let type = 'initial';
            let title = 'Initial Connection';
            let description = 'SpiceDB connection established';
            
            if (currentLastState !== null) {
                if (newConnectedState) {
                    type = 'reconnected';
                    title = 'Connection Restored';
                    description = 'Successfully reconnected to SpiceDB';
                } else {
                    type = 'disconnected';
                    title = 'Connection Lost';
                    description = 'Unable to reach SpiceDB';
                }
            }
            
            // Add new entry
            const newEntry = {
                connected: newConnectedState,
                responseTime: responseTime || null,
                timestamp: timestamp || new Date().toISOString(),
                id: Date.now(),
                type: type,
                title: title,
                description: description
            };
            
            currentHistory.unshift(newEntry);
            
            // Keep only the most recent entries
            const trimmedHistory = currentHistory.slice(0, MAX_HISTORY_ENTRIES);
            
            // Save to file
            saveHistory(trimmedHistory, newConnectedState);
            
            return res.status(200).json({ 
                success: true, 
                added: true,
                entry: newEntry 
            });
        }
        
        return res.status(200).json({ 
            success: true, 
            added: false,
            message: 'No state change detected' 
        });
    }

    return res.status(405).json({ message: 'Method not allowed' });
}