# Numira Project Planning

## Project Vision

Numira is a self-reflection and journaling application that uses AI personas to help users process their thoughts and emotions. The application provides a guided experience where users can select different AI personas and conversation contexts (rooms) to facilitate meaningful self-reflection and personal growth.

## Architecture Overview

The project follows a modern web application architecture with a clear separation between frontend and backend:

### Frontend Architecture

- **Framework**: React.js
- **State Management**: React Hooks
- **API Communication**: Custom fetch utilities
- **Styling**: CSS with variables for theming
- **Component Structure**: Modular components organized by feature

### Backend Architecture

- **Framework**: Node.js with Express
- **Database**: Prisma ORM with SQL database
- **Authentication**: JWT-based authentication
- **API Structure**: RESTful API endpoints
- **Background Processing**: Queue-based processing for non-blocking operations
- **AI Integration**: Integration with LLM providers for AI personas

### System Components

1. **User Management**
   - Authentication and authorization
   - User profiles and preferences
   - Terms acceptance and disclaimers

2. **Persona System**
   - Multiple AI personas with distinct personalities
   - Persona selection and management
   - Persona-specific prompt templates

3. **Room System**
   - Different conversation contexts (rooms)
   - Room-specific behaviors and themes
   - Room selection and management

4. **Conversation Engine**
   - Prompt handling and processing
   - AI response generation and formatting
   - Conversation history management

5. **Journaling System**
   - Saving conversations as journal entries
   - Journal entry management and retrieval
   - Journal insights and analysis

6. **Offline Support**
   - Local storage for offline usage
   - Sync mechanism for reconnection
   - Offline-first user experience

7. **Payment Integration**
   - Subscription management
   - Payment processing
   - Billing and invoicing

## Tech Stack

### Frontend
- React.js
- HTML5/CSS3
- Fetch API for network requests
- Service workers for offline functionality

### Backend
- Node.js
- Express.js
- Prisma ORM
- JWT for authentication
- Queue system for background processing

### Database
- SQL database (via Prisma)
- Migration system for schema changes

### AI/ML
- Integration with LLM providers
- Prompt engineering system
- Sentiment analysis

### DevOps
- Docker for containerization
- CI/CD pipeline
- Automated testing

## Constraints and Considerations

### Technical Constraints
- Must support offline functionality
- Must handle API rate limiting for LLM providers
- Must ensure data privacy and security
- Must be responsive for all device sizes

### Business Constraints
- Must comply with relevant regulations (GDPR, CCPA)
- Must include proper disclaimers for AI-generated content
- Must provide clear terms of service and privacy policy

### Performance Goals
- API response times under 200ms (excluding LLM calls)
- LLM response times optimized for user experience
- Frontend load time under 2 seconds
- Smooth transitions and animations (60fps)

## Development Guidelines

### Code Style
- Follow consistent naming conventions
- Use meaningful variable and function names
- Document all functions and complex logic
- Keep files under 500 lines of code

### Testing Strategy
- Unit tests for all business logic
- Integration tests for API endpoints
- End-to-end tests for critical user flows
- Test coverage goal: 80%+

### Documentation
- Maintain up-to-date API documentation
- Document database schema changes
- Keep README and other docs current
- Include comments for complex logic

## Roadmap

### Phase 1: Core Functionality
- Basic user authentication
- Initial persona and room implementation
- Conversation functionality
- Simple journaling features

### Phase 2: Enhanced Features
- Offline support
- Additional personas and rooms
- Advanced journaling with insights
- Improved UI/UX

### Phase 3: Monetization and Scale
- Payment integration
- Family plans
- Advanced analytics
- Performance optimizations

### Phase 4: Platform Expansion
- Mobile applications
- API for third-party integrations
- Additional language support
- Community features
