import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PersonaSelector from '../../components/PersonaSelector';

// Mock data for testing
const mockPersonas = [
  {
    id: 'persona1',
    name: 'Ayla',
    description: 'Empathetic and warm guide',
    tags: ['empathetic', 'warm', 'supportive']
  },
  {
    id: 'persona2',
    name: 'Cam',
    description: 'Analytical and direct guide',
    tags: ['analytical', 'direct', 'logical']
  },
  {
    id: 'persona3',
    name: 'Rumi',
    description: 'Philosophical and poetic guide',
    tags: ['philosophical', 'poetic', 'reflective']
  }
];

describe('PersonaSelector Component', () => {
  // Test for expected use
  test('renders all personas correctly', () => {
    const handleSelect = jest.fn();
    render(<PersonaSelector personas={mockPersonas} selectedPersona={null} onSelectPersona={handleSelect} />);
    
    // Check if all personas are rendered
    expect(screen.getByText('Ayla')).toBeInTheDocument();
    expect(screen.getByText('Cam')).toBeInTheDocument();
    expect(screen.getByText('Rumi')).toBeInTheDocument();
    
    // Check if descriptions are rendered
    expect(screen.getByText('Empathetic and warm guide')).toBeInTheDocument();
    expect(screen.getByText('Analytical and direct guide')).toBeInTheDocument();
    expect(screen.getByText('Philosophical and poetic guide')).toBeInTheDocument();
    
    // Check if tags are rendered
    expect(screen.getByText('empathetic')).toBeInTheDocument();
    expect(screen.getByText('analytical')).toBeInTheDocument();
    expect(screen.getByText('philosophical')).toBeInTheDocument();
  });
  
  // Test for interaction
  test('calls onSelectPersona when a persona is clicked', () => {
    const handleSelect = jest.fn();
    render(<PersonaSelector personas={mockPersonas} selectedPersona={null} onSelectPersona={handleSelect} />);
    
    // Click on a persona
    fireEvent.click(screen.getByText('Ayla'));
    
    // Check if the handler was called with the correct persona
    expect(handleSelect).toHaveBeenCalledWith('persona1');
  });
  
  // Test for selected state
  test('highlights the selected persona', () => {
    const handleSelect = jest.fn();
    render(<PersonaSelector personas={mockPersonas} selectedPersona="persona2" onSelectPersona={handleSelect} />);
    
    // Get all persona cards
    const personaCards = document.querySelectorAll('.persona-card');
    
    // Check if the correct persona is highlighted
    expect(personaCards[1]).toHaveClass('selected');
    expect(personaCards[0]).not.toHaveClass('selected');
    expect(personaCards[2]).not.toHaveClass('selected');
  });
  
  // Test for edge case - empty personas array
  test('renders no personas when array is empty', () => {
    const handleSelect = jest.fn();
    render(<PersonaSelector personas={[]} selectedPersona={null} onSelectPersona={handleSelect} />);
    
    // Check if the component renders with no personas
    expect(document.querySelectorAll('.persona-card').length).toBe(0);
  });
  
  // Test for failure case - null personas
  test('handles null personas gracefully', () => {
    const handleSelect = jest.fn();
    render(<PersonaSelector personas={null} selectedPersona={null} onSelectPersona={handleSelect} />);
    
    // Check if the component renders without crashing
    expect(document.querySelector('.persona-selector')).toBeInTheDocument();
    expect(document.querySelectorAll('.persona-card').length).toBe(0);
  });
});
