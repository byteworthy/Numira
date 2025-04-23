/**
 * Rooms Configuration
 * 
 * This file defines all available rooms in the Numira application.
 * Each room has a specific purpose, compatible personas, and features
 * that shape the user experience and guide interactions.
 */

const rooms = [
  {
    id: 'mirrorRoom',
    name: 'Mirror Room',
    description: 'A space for self-reflection and emotional exploration. Explore your feelings, thoughts, and patterns with gentle guidance to gain deeper self-understanding.',
    purpose: 'To help users gain insight into their emotions and thought patterns through guided self-reflection and emotional awareness.',
    supportedPersonas: ['ayla', 'cam', 'rumi', 'sage'],
    samplePrompt: 'I have been feeling overwhelmed lately and I am not sure why.',
    tags: ['reflection', 'emotional-awareness', 'self-discovery', 'insight', 'patterns'],
    promptType: 'open',
    features: {
      emotionTracking: true,
      patternRecognition: true,
      reflectiveQuestions: true,
      insightGeneration: true,
      emotionalNuance: true
    }
  },
  {
    id: 'reframeRoom',
    name: 'Reframe Room',
    description: 'A space for shifting perspectives and challenging limiting beliefs. Transform how you see situations by exploring alternative viewpoints and identifying cognitive distortions.',
    purpose: 'To help users break free from limiting perspectives and develop more empowering ways of viewing situations through cognitive reframing techniques.',
    supportedPersonas: ['cam', 'jax', 'rumi', 'nova'],
    samplePrompt: 'I keep thinking I am not good enough for this job.',
    tags: ['perspective-shift', 'cognitive-reframing', 'belief-work', 'transformation', 'distortions'],
    promptType: 'targeted',
    features: {
      beliefIdentification: true,
      perspectiveShifting: true,
      thoughtChallenging: true,
      alternativeViewpoints: true,
      distortionRecognition: true
    }
  },
  {
    id: 'moodBooth',
    name: 'Mood Booth',
    description: 'A space for emotional check-ins and mood tracking. Monitor your emotional patterns, identify triggers, and gain insights into what affects your emotional state over time.',
    purpose: 'To help users track, understand, and gain insights into their emotional patterns through regular check-ins and pattern recognition.',
    supportedPersonas: ['ayla', 'jax', 'sage', 'nova'],
    samplePrompt: 'I want to check in about how I am feeling today.',
    tags: ['mood-tracking', 'emotional-awareness', 'patterns', 'check-in', 'triggers'],
    promptType: 'short_form',
    features: {
      moodTracking: true,
      emotionVisualization: true,
      patternRecognition: true,
      triggerIdentification: true,
      trendAnalysis: true
    }
  },
  {
    id: 'clarityBar',
    name: 'Clarity Bar',
    description: 'A space for decision-making support and problem-solving. Gain clarity on complex situations by exploring options, aligning with your values, and structuring your thinking.',
    purpose: 'To help users gain clarity on complex situations, explore options, and make decisions with greater confidence through structured frameworks and value alignment.',
    supportedPersonas: ['cam', 'jax', 'ayla', 'rumi', 'nova', 'sage'],
    samplePrompt: 'I need to make a decision about whether to change careers.',
    tags: ['decision-making', 'problem-solving', 'clarity', 'options-exploration', 'values'],
    promptType: 'guided',
    features: {
      decisionFrameworks: true,
      optionsExploration: true,
      proConAnalysis: true,
      valueAlignment: true,
      consequenceMapping: true
    }
  },
  {
    id: 'anchorDeck',
    name: 'Anchor Deck',
    description: 'A space for grounding and centering when feeling overwhelmed. Connect with the present moment through sensory awareness, embodiment practices, and simple mindfulness techniques.',
    purpose: 'To help users ground themselves in the present moment and regain a sense of stability during times of stress or overwhelm through mindfulness and embodiment practices.',
    supportedPersonas: ['sage', 'ayla', 'rumi'],
    samplePrompt: 'I am feeling really anxious and need to ground myself.',
    tags: ['grounding', 'mindfulness', 'present-moment', 'embodiment', 'centering'],
    promptType: 'guided',
    features: {
      sensoryAwareness: true,
      breathingTechniques: true,
      bodyScanning: true,
      presentMomentFocus: true,
      simplificationTechniques: true
    }
  },
  {
    id: 'flashlightRoom',
    name: 'Flashlight Room',
    description: 'A space for illuminating blind spots and uncovering hidden patterns. Explore aspects of your thinking or behavior that may be outside your awareness through gentle but direct inquiry.',
    purpose: 'To help users discover blind spots and unconscious patterns through Socratic questioning and gentle exploration of assumptions and unexamined beliefs.',
    supportedPersonas: ['jax', 'cam', 'nova'],
    samplePrompt: 'I keep ending up in the same situation and I do not understand why.',
    tags: ['blind-spots', 'patterns', 'socratic-method', 'assumptions', 'self-awareness'],
    promptType: 'targeted',
    features: {
      socraticQuestioning: true,
      assumptionExploration: true,
      patternIdentification: true,
      gentleChallenge: true,
      insightGeneration: true
    }
  }
];

module.exports = rooms;
