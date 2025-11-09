// script.js 
import { VoiceManager } from './VoiceManager.js';

// 1. Get HTML elements
const voiceToggleContainer = document.getElementById('voiceToggleContainer');
const stopButton = document.getElementById('stopButton');
const connectionStatusEl = document.getElementById('connectionStatus');
const agentStatusEl = document.getElementById('agentStatus');
const chatMessagesEl = document.getElementById('chat-messages');
const agentImageEl = document.getElementById('agentImage'); 

// 2. Instantiate the Manager
const AGENT_ID = "agent_9301k6sdj3ydedfass828rtpf0rc";
// Get confirm/retry buttons (may be hidden initially)
const confirmBtn = document.getElementById('confirmBtn');
const retryBtn = document.getElementById('retryBtn');

const voiceManager = new VoiceManager(AGENT_ID, agentImageEl, stopButton, confirmBtn, retryBtn);

// 3. Handle Toggling (Clicking the duck)
voiceToggleContainer.addEventListener('click', async (event) => { 
    // CRITICAL FIX: Stop the event from bubbling up to parent elements
    event.preventDefault(); 
    event.stopPropagation();
    
    console.warn("*******************************************");
    console.warn("CLICK HANDLER FIRED! Attempting startSession.");
    console.warn("*******************************************");

    if (!voiceManager.conversation) {
        try {
            // Wait for the session to start before initiating guided-fill
            console.debug('[script] starting voice session and guided-fill');
            await voiceManager.startSession(connectionStatusEl, agentStatusEl, chatMessagesEl);

            // Start guided-fill: go through each text box in order
            voiceManager.startGuidedFill([
                'project-name',
                'project-purpose',
                'target-audience',
                'known-competitors'
            ]);
        } catch (err) {
            console.error('Failed to start voice session:', err);
        }
    }
});

// 4. Handle Stop Button
stopButton.addEventListener('click', () => {
    voiceManager.endSession(connectionStatusEl, agentStatusEl);
});