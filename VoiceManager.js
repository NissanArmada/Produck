// VoiceManager.js

import { Conversation } from 'https://esm.sh/@elevenlabs/client';

export class VoiceManager {
    constructor(agentId, imageElement, stopButtonEl, confirmBtnEl = null, retryBtnEl = null) {
        this.conversation = null;
        this.isSpeaking = false;
        this.hasStartedSpeaking = false; 
        
        this.AGENT_ID = agentId;
        this.agentImageEl = imageElement;
    this.stopButtonEl = stopButtonEl;
    // Optional confirm/retry button elements (clickable confirmation)
    this.confirmBtnEl = confirmBtnEl;
    this.retryBtnEl = retryBtnEl;
    // The container that holds confirm/retry buttons (if present)
    this.confirmControlsEl = (this.confirmBtnEl ? this.confirmBtnEl.parentElement : null);
    // Save original parent/nextSibling so we can restore location after moving
    this._confirmOriginalParent = this.confirmControlsEl ? this.confirmControlsEl.parentElement : null;
    this._confirmOriginalNextSibling = this.confirmControlsEl ? this.confirmControlsEl.nextSibling : null;

    // Guided form-fill state
    this.chatMessagesEl = null; // set when session starts
    this.guidedFields = [];
    this.guidedIndex = 0;
    this.guidedMode = false;
    this.guidedAttempts = {}; // track attempts per field
    this.provisionalData = {}; // temporary document of user-provided values
    // Confirmation flow state
    this.awaitingConfirmation = false;
    this.confirmField = null;
    this.confirmValue = null;

        // --- Image States ---
        this.INACTIVE_IMAGE = "png3.png"; // Clickable (Start session)
        this.IDLE_IMAGE = "png1.png";     // Connected (Listening)
        this.SPEAKING_IMAGE = "png2.png"; // Agent is talking

        this.agentImageEl.src = this.INACTIVE_IMAGE;

    // Buffer for any AI messages received while awaiting a user confirmation
    this._pendingAgentMessages = [];

        // Wire confirm/retry button handlers if provided
        if (this.confirmBtnEl) {
            // hide initially
            try { this.confirmBtnEl.style.display = 'none'; } catch (e) {}
            this._onConfirmClick = this._onConfirmClick.bind(this);
            this.confirmBtnEl.addEventListener('click', this._onConfirmClick);
        }
        if (this.retryBtnEl) {
            try { this.retryBtnEl.style.display = 'none'; } catch (e) {}
            this._onRetryClick = this._onRetryClick.bind(this);
            this.retryBtnEl.addEventListener('click', this._onRetryClick);
        }
    }

    // Click handlers for confirm/retry buttons
    _onConfirmClick() {
        if (!this.awaitingConfirmation) return;
        console.debug('[confirmBtn] clicked');
        // reuse positive confirmation flow
        this._commitConfirmation();
    }

    _onRetryClick() {
        if (!this.awaitingConfirmation) return;
        console.debug('[retryBtn] clicked');
        this._rejectConfirmation();
    }

    _commitConfirmation() {
        const fieldId = this.confirmField;
        const finalValue = this.confirmValue;
        const inputElement = document.getElementById(fieldId);
        if (inputElement) {
            inputElement.value = finalValue;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            this.addMessageToChat('Agent', `Confirmed. Saved '${finalValue}' for ${fieldId}.`, this.chatMessagesEl);
        } else {
            this.addMessageToChat('System', `Field '${fieldId}' not found. Skipping.`, this.chatMessagesEl);
        }

        // Reset confirmation state and UI
        this._hideConfirmButtons();
        this.awaitingConfirmation = false;
        this.confirmField = null;
        this.confirmValue = null;
        this.guidedAttempts[fieldId] = 0;
        this.guidedIndex += 1;
        this.promptForCurrentField();
        // Clear any AI messages that arrived while we were awaiting confirmation
        try { this._clearPendingAgentMessages(); } catch (e) { console.debug('Error clearing pending messages:', e); }
    }

    _rejectConfirmation() {
        const fieldId = this.confirmField;
        // Reset state and re-prompt
        this._hideConfirmButtons();
        this.awaitingConfirmation = false;
        this.confirmField = null;
        this.confirmValue = null;
        this.addMessageToChat('Agent', `Okay — please say the value for that field again.`, this.chatMessagesEl);
        this.promptForCurrentField();
        // Clear any AI messages that arrived while we were awaiting confirmation
        try { this._clearPendingAgentMessages(); } catch (e) { console.debug('Error clearing pending messages:', e); }
    }

    _showConfirmButtons() {
        try {
            if (this.confirmControlsEl && this.confirmField) {
                // Move the controls to be immediately after the active input element
                const inputEl = document.getElementById(this.confirmField);
                if (inputEl) {
                    // Insert the whole controls container after the input element
                    inputEl.insertAdjacentElement('afterend', this.confirmControlsEl);
                }
            }
        } catch (e) { console.debug('Error moving confirm controls:', e); }
        try { if (this.confirmControlsEl) this.confirmControlsEl.style.display = 'block'; } catch (e) {}
        try { if (this.confirmBtnEl) this.confirmBtnEl.style.display = 'inline-block'; } catch (e) {}
        try { if (this.retryBtnEl) this.retryBtnEl.style.display = 'inline-block'; } catch (e) {}
    }

    _hideConfirmButtons() {
        try { if (this.confirmControlsEl) this.confirmControlsEl.style.display = 'none'; } catch (e) {}
        try { if (this.confirmBtnEl) this.confirmBtnEl.style.display = 'none'; } catch (e) {}
        try { if (this.retryBtnEl) this.retryBtnEl.style.display = 'none'; } catch (e) {}
        try {
            // Restore the controls container to its original location in the sidebar
            if (this.confirmControlsEl && this._confirmOriginalParent) {
                if (this._confirmOriginalNextSibling) {
                    this._confirmOriginalParent.insertBefore(this.confirmControlsEl, this._confirmOriginalNextSibling);
                } else {
                    this._confirmOriginalParent.appendChild(this.confirmControlsEl);
                }
            }
        } catch (e) { console.debug('Error restoring confirm controls:', e); }
    }

    // Simple helpers to interpret short yes/no confirmations from user speech
    isPositiveConfirmation(text) {
        if (!text) return false;
        const t = text.toLowerCase().trim();
        return /^(yes|yep|yeah|correct|right|confirm|sure|y)$/i.test(t) || t.includes('that') && t.includes('right');
    }

    isNegativeConfirmation(text) {
        if (!text) return false;
        const t = text.toLowerCase().trim();
        return /^(no|nope|nah|not|incorrect|wrong|change|don't|dont)/i.test(t) || t.includes('not right') || t.includes('wrong');
    }

    updateImage(isSpeaking) {
        this.isSpeaking = isSpeaking;
        let newSrc;
        
        if (!this.conversation) {
            newSrc = this.INACTIVE_IMAGE;
        } else if (isSpeaking) {
            newSrc = this.SPEAKING_IMAGE;
        } else {
            newSrc = this.IDLE_IMAGE;
        }
        
        if (this.agentImageEl) {
            this.agentImageEl.src = newSrc;
            console.log(`[Image Swap] Setting image source to: ${newSrc}`);
        }
    }

    addMessageToChat(source, text, chatMessagesEl) {
        const msgElement = document.createElement('p');
        msgElement.innerHTML = `<strong>[${source}]</strong>: ${text}`;
        chatMessagesEl.appendChild(msgElement);
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }

    _clearPendingAgentMessages() {
        if (!this._pendingAgentMessages || this._pendingAgentMessages.length === 0) return;
        console.debug(`[pendingMessages] Clearing ${this._pendingAgentMessages.length} buffered AI messages`);
        // For now we drop them to avoid accidental follow-ups; keep them available for debugging if needed
        this._pendingAgentMessages = [];
    }

    calculateSpeakingDelay(text) {
        if (!text) return 2000; 
        const words = text.trim().split(/\s+/).length;
        const estimatedTimeMs = (words / 180) * 60000; 
        const totalDelay = Math.max(2500, estimatedTimeMs + 500); // Minimum 2.5s delay
        return totalDelay;
    }
    
    /**
     * Parses agent text for JSON commands to fill the form elements.
     */
    processAgentResponseForForm(text) {
        // Find JSON format: {'field': 'key', 'value': 'data'}
        const regex = /\{'field':\s*'([^']+)',\s*'value':\s*'([^']+)'\}/;
        const match = text.match(regex);

        if (match) {
            const fieldId = match[1]; 
            const value = match[2];     
            const inputElement = document.getElementById(fieldId);

            if (inputElement) {
                const cleanedText = text.replace(match[0], '').trim();
                
                inputElement.value = value;
                // Dispatch events to trigger any JS frameworks or validation
                inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                
                console.log(`[FORM FILL] Field '${fieldId}' set to: '${value}'`);
                return cleanedText; 
            }
        }
        return text;
    }

    async startSession(connectionStatusEl, agentStatusEl, chatMessagesEl) {
        if (this.conversation) return;

        try {
            connectionStatusEl.innerText = "connecting...";
            this.hasStartedSpeaking = false; 
            this.stopButtonEl.style.display = 'block';

            // Save chat container reference for guided-fill prompts
            this.chatMessagesEl = chatMessagesEl;

            const micStream = await navigator.mediaDevices.getUserMedia({ 
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });

            this.conversation = await Conversation.startSession({
                agentId: this.AGENT_ID,
                connectionType: "webrtc",
                input: micStream,
                output: true, 
                timeout: 10000, 

                onAudio: (audioChunk) => {
                    if (!this.hasStartedSpeaking) {
                        this.hasStartedSpeaking = true;
                        setTimeout(() => {
                            agentStatusEl.innerText = "speaking...";
                            this.updateImage(true); // Change to png2.png
                        }, 100); 
                    }
                },
                
                onStatusChange: (status) => {
                    connectionStatusEl.innerText = status;
                },

                onMessage: (message) => {
                    let textToDisplay = message.message;
                    const source = message.source === 'user' ? 'You' : 'Agent';

                    // If we're awaiting a confirmation, buffer any incoming AI messages to avoid the assistant
                    // asking follow-up questions before the user confirms.
                    if (message.source === 'ai' && this.awaitingConfirmation) {
                        try {
                            this._pendingAgentMessages.push(message);
                            console.debug('[onMessage] Buffered AI message while awaiting confirmation');
                        } catch (e) { console.debug('Error buffering AI message:', e); }
                        return;
                    }

                    if (message.source === 'ai') {
                        // Process form filling data and clean the text
                        textToDisplay = this.processAgentResponseForForm(message.message);
                    } else if (message.source === 'user') {
                        // If guided mode is active, use user speech to fill the next field
                        this.processUserSpeechForForm(message.message);
                    }
                    
                    if (message.message) {
                        this.addMessageToChat(source, textToDisplay, chatMessagesEl);
                    }

                    if (message.message && message.source === 'ai') {
                        const delay = this.calculateSpeakingDelay(textToDisplay);

                        setTimeout(() => {
                            if (this.isSpeaking) {
                                agentStatusEl.innerText = "idle";
                                this.updateImage(false); // Change to png1.png
                                // CRITICAL: Reset flag for the next turn
                                this.hasStartedSpeaking = false;
                            }
                        }, delay); 
                    }
                },
                onError: (error) => {
                    console.error("Conversation error:", error);
                    connectionStatusEl.innerText = "error";
                    this.updateImage(false);
                    this.stopButtonEl.style.display = 'none';
                }
            });

            agentStatusEl.innerText = "idle";
            connectionStatusEl.innerText = "Listening...";
            this.updateImage(false); // Set to png1.png (Idle)

        } catch (error) {
            console.error("Failed to start session:", error);
            connectionStatusEl.innerText = "error";
            agentStatusEl.innerText = "INACTIVE";
            this.updateImage(false); // Set to png3.png (Inactive)
            this.stopButtonEl.style.display = 'none';
        }
    }

    /* Guided form-fill methods -------------------------------------------------- */
    startGuidedFill(fieldIdList) {
        if (!Array.isArray(fieldIdList) || fieldIdList.length === 0) return;
        this.guidedFields = fieldIdList.slice();
        this.guidedIndex = 0;
        this.guidedMode = true;
        this.promptForCurrentField();
    }

    promptForCurrentField() {
        if (!this.guidedMode || !this.chatMessagesEl) return;
        if (this.guidedIndex >= this.guidedFields.length) {
            this.addMessageToChat('Agent', 'All fields completed. Thank you!', this.chatMessagesEl);
            this.guidedMode = false;
            this.clearFieldHighlight();
            return;
        }
        const fieldId = this.guidedFields[this.guidedIndex];
        const labelEl = document.querySelector(`label[for="${fieldId}"]`);
        const friendly = labelEl ? labelEl.innerText.replace(/:\s*$/, '') : fieldId;
        console.debug(`[promptForCurrentField] prompting for field='${fieldId}' (friendly='${friendly}') index=${this.guidedIndex}`);
        // Visually highlight the active field and its label
        this.setFieldHighlight(fieldId);
        this.addMessageToChat('Agent', `Please say the value for: ${friendly}`, this.chatMessagesEl);
    }

    setFieldHighlight(fieldId) {
        // Clear previous highlight
        this.clearFieldHighlight();
        const inputEl = document.getElementById(fieldId);
        const labelEl = document.querySelector(`label[for="${fieldId}"]`);
        if (inputEl) inputEl.classList.add('field-highlight');
        if (labelEl) labelEl.classList.add('field-highlight-label');
    }

    clearFieldHighlight() {
        // remove from any previously highlighted elements
        const prev = document.querySelectorAll('.field-highlight');
        prev.forEach(el => el.classList.remove('field-highlight'));
        const prevL = document.querySelectorAll('.field-highlight-label');
        prevL.forEach(el => el.classList.remove('field-highlight-label'));
    }

    // Server-side validation using Gemini: send the provisional document and target field
    async validateWithServer(fieldId) {
        // Client-side cooldown check: avoid calling server when recently rate-limited
        try {
            const now = Date.now();
            const stored = localStorage.getItem('validation_cooldown_until');
            if (stored) {
                const until = parseInt(stored, 10) || 0;
                if (until > now) {
                    const remaining = Math.ceil((until - now) / 1000);
                    console.debug(`[validateWithServer] Suppressing validation call due to client cooldown (${remaining}s left)`);
                    return { ok: false, follow_up: `Validation service rate-limited. Please try again in ${remaining} seconds.`, value: null };
                }
            }

            // Use explicit API base if provided by the page (form.html sets API_BASE_URL)
            const base = (window.API_BASE_URL || window.location.origin).replace(/\/$/, '');
            console.debug(`[validateWithServer] Sending validation request to ${base} for field='${fieldId}' provisional=`, this.provisionalData);
            const resp = await fetch(`${base}/api/v1/validate-provisional`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provisional: this.provisionalData, field: fieldId })
            });

            // If the server returns a non-2xx status, try to parse a helpful JSON body
            if (!resp.ok) {
                let bodyText = null;
                try {
                    const bodyJson = await resp.json();
                    // If the server included a follow_up, return that to the caller
                    if (bodyJson && (bodyJson.follow_up || typeof bodyJson.ok !== 'undefined')) {
                        console.debug('[validateWithServer] Server returned non-2xx but provided JSON:', bodyJson);
                        // If server indicates rate-limit (429), set client cooldown
                        if (resp.status === 429) {
                            // Try to extract seconds from follow_up or use 60s default
                            let retry = 60;
                            const m = /(?:(?:in|after)\s*)(\d+)\s*seconds?/i.exec(bodyJson.follow_up || '');
                            if (m) try { retry = parseInt(m[1], 10); } catch (e) {}
                            const until = Date.now() + (retry * 1000);
                            localStorage.setItem('validation_cooldown_until', String(until));
                            console.debug(`[validateWithServer] Client cooldown set for ${retry}s`);
                        }
                        return bodyJson;
                    }
                    bodyText = JSON.stringify(bodyJson);
                } catch (e) {
                    try { bodyText = await resp.text(); } catch (e2) { bodyText = null; }
                }

                console.error('Validation endpoint error:', resp.status, bodyText);
                // Surface the server message when available, otherwise return a friendly prompt
                // If this was a 429, try to read seconds from bodyText and set cooldown
                if (resp.status === 429) {
                    let retry = 60;
                    const m = /(?:(?:in|after)\s*)(\d+)\s*seconds?/i.exec(bodyText || '');
                    if (m) try { retry = parseInt(m[1], 10); } catch (e) {}
                    const until = Date.now() + (retry * 1000);
                    localStorage.setItem('validation_cooldown_until', String(until));
                    console.debug(`[validateWithServer] Client cooldown set for ${retry}s (from text)`);
                    return { ok: false, follow_up: `Validation service rate-limited. Please try again in ${retry} seconds.`, value: null };
                }

                const followUpMsg = bodyText || 'Server validation failed. Please rephrase.';
                return { ok: false, follow_up: followUpMsg, value: null };
            }

            const data = await resp.json();
            console.debug('[validateWithServer] Validation response:', data);
            return data;
        } catch (err) {
            console.error('Validation request failed', err);
            return { ok: false, follow_up: 'Validation request failed. Please try again.', value: null };
        }
    }

    processUserSpeechForForm(text) {
        if (!this.guidedMode) return;

        // If we're waiting for a yes/no confirmation, interpret this speech as confirmation
        if (this.awaitingConfirmation) {
            const confText = (text || '').trim();
            console.debug(`[confirmation] interpreting confirmation for field='${this.confirmField}' text='${confText}'`);
            if (this.isPositiveConfirmation(confText)) {
                // Commit the previously staged value
                const fieldId = this.confirmField;
                const finalValue = this.confirmValue;
                const inputElement = document.getElementById(fieldId);
                if (inputElement) {
                    inputElement.value = finalValue;
                    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                    this.addMessageToChat('Agent', `Confirmed. Saved '${finalValue}' for ${fieldId}.`, this.chatMessagesEl);
                } else {
                    this.addMessageToChat('System', `Field '${fieldId}' not found. Skipping.`, this.chatMessagesEl);
                }

                // Reset confirmation state and move on
                this.awaitingConfirmation = false;
                this.confirmField = null;
                this.confirmValue = null;
                this.guidedAttempts[fieldId] = 0;
                console.debug(`[confirmation] confirmed and committed field='${fieldId}' value='${finalValue}'`);
                this.guidedIndex += 1;
                this.promptForCurrentField();
                try { this._clearPendingAgentMessages(); } catch (e) { console.debug('Error clearing pending messages after speech confirm:', e); }
                return;
            }

            if (this.isNegativeConfirmation(confText)) {
                console.debug(`[confirmation] negative confirmation for field='${this.confirmField}'`);
                // User rejected - ask them to restate the value for the same field
                const fieldId = this.confirmField;
                this.awaitingConfirmation = false;
                this.confirmField = null;
                this.confirmValue = null;
                this.addMessageToChat('Agent', `Okay — please say the value for that field again.`, this.chatMessagesEl);
                // Re-prompt the same field without advancing the index
                this.promptForCurrentField();
                try { this._clearPendingAgentMessages(); } catch (e) { console.debug('Error clearing pending messages after speech reject:', e); }
                return;
            }

            // If unclear answer, ask explicit yes/no
            // Don't post a textual yes/no prompt; show the clickable confirm/retry buttons instead
            this._showConfirmButtons();
            try { if (this.confirmBtnEl) this.confirmBtnEl.focus(); } catch (e) {}
            return;
        }

        const fieldId = this.guidedFields[this.guidedIndex];
        if (!fieldId) return;

        const inputElement = document.getElementById(fieldId);
        if (!inputElement) {
            // If input not found, still advance to avoid lock
            this.addMessageToChat('System', `Field '${fieldId}' not found. Skipping.`, this.chatMessagesEl);
            this.guidedIndex += 1;
            this.promptForCurrentField();
            return;
        }

        const cleaned = (text || '').trim();

        // Immediately commit the user's spoken text into the input so the flow stays simple.
        this.provisionalData[fieldId] = cleaned;
        if (inputElement) {
            inputElement.value = cleaned;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            this.addMessageToChat('Agent', `Saved '${cleaned}' for ${fieldId}.`, this.chatMessagesEl);
        } else {
            this.addMessageToChat('System', `Field '${fieldId}' not found. Skipping.`, this.chatMessagesEl);
        }

        // Advance to next field immediately (do not wait for model validation)
        this.guidedAttempts[fieldId] = 0;
        this.guidedIndex += 1;
        this.promptForCurrentField();

        // Fire off validation in the background; do not block or require confirmation.
        this.validateWithServer(fieldId).then(result => {
            if (!result) return;
            // If the model asks a follow-up, show it as an informational message (non-blocking)
            if (result.follow_up) {
                this.addMessageToChat('Agent', result.follow_up, this.chatMessagesEl);
            }
            // If model normalized to a different value, show a non-blocking suggestion
            if (result.ok && result.value && result.value !== cleaned) {
                this.addMessageToChat('Agent', `Suggestion: ${result.value}`, this.chatMessagesEl);
            }
        }).catch(err => {
            console.debug('Background validation failed:', err);
            // don't block user flow on validation errors
        });
    }

    async endSession(connectionStatusEl, agentStatusEl) {
        if (!this.conversation) return;

        await this.conversation.endSession();
        this.conversation = null;
        this.hasStartedSpeaking = false;
        
        agentStatusEl.innerText = "INACTIVE";
        connectionStatusEl.innerText = "Click the duck to start voice chat";
        this.updateImage(false); // Set to png3.png (Inactive)
        this.stopButtonEl.style.display = 'none';
    }
}