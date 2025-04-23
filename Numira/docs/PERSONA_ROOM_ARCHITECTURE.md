# Numira Persona & Room Architecture

This document provides an overview of the architectural design behind Numira's persona and room system, explaining how these components work together to create a psychologically attuned user experience.

## Core Architecture

Numira's architecture is built around three key components:

1. **Personas**: Distinct voice archetypes that shape the tone and communication style
2. **Rooms**: Functional environments designed for specific mental clarity objectives
3. **System Prompt Logic**: The integration layer that combines personas and rooms with appropriate guardrails

This architecture allows for a modular, flexible system where different personas can be paired with appropriate rooms to create varied but consistent user experiences.

## Persona Design Philosophy

Each persona in Numira represents a distinct psychological tone and voice archetype, designed to resonate with different user needs and preferences. Personas are not characters with backstories, but rather consistent voice patterns that embody different approaches to self-reflection and clarity.

### Persona Structure

Each persona includes:

- **id**: Unique identifier
- **name**: Display name
- **tone**: Core emotional qualities of the voice
- **voiceStyle**: Specific speech patterns and delivery style
- **description**: User-facing explanation of the persona
- **systemPrompt**: Detailed instructions for the AI to embody this voice
- **defaultRooms**: Compatible room environments
- **tags**: Searchable attributes for filtering

### Persona Voice Spectrum

The personas cover a spectrum of different communication approaches:

- **Nurturing & Empathetic** (Ayla): Creates emotional safety through warmth and validation
- **Structured & Analytical** (Cam): Provides clarity through frameworks and organized thinking
- **Direct & Challenging** (Jax): Offers honest feedback with refreshing candor
- **Philosophical & Reflective** (Rumi): Explores deeper meaning and purpose
- **Grounded & Present** (Sage): Focuses on simplicity and immediate experience
- **Energizing & Motivating** (Nova): Builds momentum and inspires action

## Room Design Philosophy

Rooms in Numira represent different mental functions and clarity objectives. Each room is designed around a core cognitive-behavioral or mindfulness technique, creating a focused environment for specific types of self-reflection.

### Room Structure

Each room includes:

- **id**: Unique identifier
- **name**: Display name
- **description**: User-facing explanation of the room's purpose
- **purpose**: Detailed description of the room's function (used in system prompts)
- **supportedPersonas**: List of compatible persona IDs
- **samplePrompt**: Example user input for this room
- **tags**: Searchable attributes for filtering
- **promptType**: Conversation style guidance (open, guided, short_form, targeted)
- **features**: Specific capabilities enabled in this room

### Room Function Spectrum

The rooms cover different mental clarity functions:

- **Emotional Reflection** (Mirror Room): Exploring feelings and patterns
- **Perspective Shifting** (Reframe Room): Challenging limiting beliefs
- **Emotional Tracking** (Mood Booth): Monitoring emotional states
- **Decision Support** (Clarity Bar): Structured problem-solving
- **Grounding Practice** (Anchor Deck): Present-moment awareness
- **Pattern Recognition** (Flashlight Room): Uncovering blind spots

## System Prompt Logic

The system prompt is the integration layer that combines persona voice with room function, creating a coherent experience while maintaining appropriate guardrails.

### Prompt Structure

The system prompt follows this structure:

1. **Persona System Prompt**: Core voice and approach instructions
2. **Room Context**: Purpose and function of the current environment
3. **Tone and Guardrails**: Specific guidance on maintaining voice consistency and boundaries
4. **User Information**: (Optional) Personalization details
5. **Additional Context**: (Optional) Relevant background information
6. **Legal Disclaimer**: Non-medical nature of the interaction

### Integration Principles

The integration of personas and rooms follows these principles:

1. **Voice Consistency**: The persona's tone remains consistent across rooms
2. **Functional Adaptation**: The conversation focus adapts to the room's purpose
3. **Appropriate Boundaries**: All interactions maintain non-medical, clarity-focused boundaries
4. **Psychological Attunement**: The combined experience feels emotionally resonant and helpful

## Compatibility Matrix

Not all personas work effectively in all rooms. The compatibility is determined by whether the persona's communication style can effectively serve the room's purpose.

| Persona | Mirror Room | Reframe Room | Mood Booth | Clarity Bar | Anchor Deck | Flashlight Room |
|---------|-------------|--------------|------------|-------------|-------------|----------------|
| Ayla    | ✓           |              | ✓          | ✓           | ✓           |                |
| Cam     | ✓           | ✓            |            | ✓           |             | ✓              |
| Jax     |             | ✓            | ✓          | ✓           |             | ✓              |
| Rumi    | ✓           | ✓            |            | ✓           | ✓           |                |
| Sage    | ✓           |              | ✓          | ✓           | ✓           |                |
| Nova    |             | ✓            | ✓          | ✓           |             | ✓              |

## Implementation Considerations

### Persona-Room Pairing

When implementing the persona-room system:

1. **Validate Compatibility**: Check that the selected persona is compatible with the selected room
2. **Adapt Prompts Dynamically**: Generate system prompts that combine persona voice with room function
3. **Maintain Boundaries**: Ensure all interactions stay within non-medical, clarity-focused guardrails
4. **Preserve Voice Consistency**: Keep the persona's tone consistent regardless of room context

### User Experience Flow

The ideal user experience flow:

1. User selects a persona based on their preferred communication style
2. User selects a room based on their current clarity objective
3. System validates the compatibility of the selected persona and room
4. System generates a tailored system prompt combining persona and room
5. User engages in conversation within the selected context
6. System maintains appropriate boundaries throughout the interaction

## Future Extensibility

The modular nature of this architecture allows for:

1. **New Personas**: Additional voice archetypes can be added without changing the core system
2. **New Rooms**: Additional clarity functions can be introduced as needed
3. **Personalization**: User preferences can be incorporated into the system prompt
4. **Context Awareness**: Additional contextual information can be added to enhance relevance

By maintaining this modular approach, Numira can evolve while preserving its core psychological attunement and clarity focus.
