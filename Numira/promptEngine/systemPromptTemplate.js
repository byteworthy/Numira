/**
 * System Prompt Template
 * 
 * Provides functionality to generate system prompts by combining
 * persona and room configurations with appropriate guardrails.
 */

/**
 * Generate a system prompt by combining persona and room prompts
 * 
 * @param {Object} options - Options for prompt generation
 * @param {Object} options.persona - The persona configuration
 * @param {Object} options.room - The room configuration
 * @param {Object} options.user - Optional user information
 * @param {Object} options.context - Optional additional context
 * @returns {string} The generated system prompt
 */
function generate(options) {
  const { persona, room, user = {}, context = {} } = options;
  
  // Start with the persona's system prompt
  let systemPrompt = getPersonaSection(persona);
  
  // Add room information
  systemPrompt += `\n\n${getRoomSection(room)}`;
  
  // Add tone and guardrails guidance
  systemPrompt += `\n\n${getToneAndGuardrails(persona, room)}`;
  
  // Add user-specific information if available
  if (user.name || user.preferences) {
    systemPrompt += `\n\n${getUserSection(user)}`;
  }
  
  // Add additional context if available
  if (Object.keys(context).length > 0) {
    systemPrompt += `\n\n${getContextSection(context)}`;
  }
  
  // End with the legal disclaimer
  systemPrompt += `\n\n${getDisclaimer()}`;
  
  return systemPrompt;
}

/**
 * Get the disclaimer section
 * 
 * @returns {string} The disclaimer text
 */
function getDisclaimer() {
  return `LEGAL DISCLAIMER:
You are not a medical professional. You may not provide therapy, diagnosis, or medical advice. You are a clarity companion only.`;
}

/**
 * Get the persona section
 * 
 * @param {Object} persona - The persona configuration
 * @returns {string} The persona section text
 */
function getPersonaSection(persona) {
  // Use the persona's system prompt directly
  return persona.systemPrompt;
}

/**
 * Get the room section
 * 
 * @param {Object} room - The room configuration
 * @returns {string} The room section text
 */
function getRoomSection(room) {
  return `CONTEXT: You are in the ${room.name}. ${room.purpose}

ROOM FUNCTION:
${room.description}`;
}

/**
 * Get tone and guardrails guidance
 * 
 * @param {Object} persona - The persona configuration
 * @param {Object} room - The room configuration
 * @returns {string} The tone and guardrails guidance
 */
function getToneAndGuardrails(persona, room) {
  return `TONE AND GUARDRAILS:
- Maintain the voice style of ${persona.name}: ${persona.tone}, ${persona.voiceStyle}
- Focus on the purpose of this interaction: ${room.purpose}
- Respond in a way that aligns with the ${room.promptType} conversation style
- Avoid clinical language or terminology that suggests medical expertise
- Do not present yourself as a healthcare professional
- If a user is in crisis, suggest they seek professional help
- Maintain appropriate boundaries and ethical standards
- Prioritize user safety and well-being above all else`;
}

/**
 * Get the user-specific section
 * 
 * @param {Object} user - User information
 * @returns {string} The user section text
 */
function getUserSection(user) {
  let userSection = 'USER INFORMATION:';
  
  if (user.name) {
    userSection += `\n- Name: ${user.name}`;
  }
  
  if (user.preferences) {
    userSection += '\n- Preferences:';
    for (const [key, value] of Object.entries(user.preferences)) {
      userSection += `\n  - ${key}: ${value}`;
    }
  }
  
  return userSection;
}

/**
 * Get the additional context section
 * 
 * @param {Object} context - Additional context
 * @returns {string} The context section text
 */
function getContextSection(context) {
  let contextSection = 'ADDITIONAL CONTEXT:';
  
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'object') {
      contextSection += `\n- ${key}:`;
      for (const [subKey, subValue] of Object.entries(value)) {
        contextSection += `\n  - ${subKey}: ${subValue}`;
      }
    } else {
      contextSection += `\n- ${key}: ${value}`;
    }
  }
  
  return contextSection;
}

module.exports = {
  generate
};
