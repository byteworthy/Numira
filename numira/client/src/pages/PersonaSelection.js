import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Button,
  CircularProgress,
  useTheme,
  Avatar,
  Divider
} from '@mui/material';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { AlertContext } from '../context/AlertContext';

const PersonaSelection = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { setAlert } = useContext(AlertContext);
  
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchPersonas = async () => {
      try {
        const res = await axios.get('/api/personas');
        setPersonas(res.data);
        
        // Set default persona if user has one in preferences
        if (user?.preferences?.defaultPersona) {
          const defaultPersona = res.data.find(
            p => p._id === user.preferences.defaultPersona
          );
          if (defaultPersona) {
            setSelectedPersona(defaultPersona._id);
          }
        } else if (res.data.length > 0) {
          // Otherwise select the first persona or the default one
          const defaultPersona = res.data.find(p => p.isDefault) || res.data[0];
          setSelectedPersona(defaultPersona._id);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching personas:', err);
        setAlert('Failed to load personas', 'error');
        setLoading(false);
      }
    };

    fetchPersonas();
  }, [user, setAlert]);

  const handleSelectPersona = (id) => {
    setSelectedPersona(id);
  };

  const handleStartConversation = async () => {
    if (!selectedPersona) {
      setAlert('Please select a persona first', 'error');
      return;
    }

    setCreating(true);
    
    try {
      // Create a new conversation with the selected persona
      const res = await axios.post('/api/conversations', {
        persona: selectedPersona
      });
      
      // Navigate to the new conversation
      navigate(`/conversation/${res.data._id}`);
    } catch (err) {
      console.error('Error creating conversation:', err);
      setAlert('Failed to create conversation', 'error');
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 'calc(100vh - 64px)'
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Choose Your Guide
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Select the persona that best matches your preferred style of reflection and support.
        </Typography>
      </Box>

      <Grid container spacing={4} sx={{ mb: 4 }}>
        {personas.map((persona) => (
          <Grid item xs={12} md={6} key={persona._id}>
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                border: selectedPersona === persona._id 
                  ? `2px solid ${persona.name === 'Ayla' ? theme.palette.primary.main : theme.palette.secondary.main}` 
                  : '2px solid transparent',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[4]
                }
              }}
              onClick={() => handleSelectPersona(persona._id)}
            >
              <Box 
                sx={{ 
                  p: 3, 
                  display: 'flex', 
                  alignItems: 'center',
                  bgcolor: persona.name === 'Ayla' 
                    ? 'primary.light' 
                    : 'secondary.light',
                  color: '#fff'
                }}
              >
                <Avatar 
                  sx={{ 
                    width: 60, 
                    height: 60, 
                    bgcolor: '#fff',
                    color: persona.name === 'Ayla' 
                      ? theme.palette.primary.main 
                      : theme.palette.secondary.main,
                    mr: 2
                  }}
                >
                  {persona.name.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                    {persona.name}
                  </Typography>
                  <Typography variant="subtitle1">
                    {persona.description.split(' ').slice(0, 3).join(' ')}...
                  </Typography>
                </Box>
              </Box>
              
              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                <Typography variant="body1" paragraph>
                  {persona.description}
                </Typography>
                
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Conversation Style:
                </Typography>
                <Typography variant="body2" paragraph>
                  {persona.name === 'Ayla' 
                    ? 'Nurturing, empathetic, and supportive. Ayla creates a safe space for reflection with gentle guidance and validation.'
                    : 'Direct, insightful, and action-oriented. Cam asks challenging questions and offers practical guidance for clarity.'}
                </Typography>
                
                <Box 
                  sx={{ 
                    p: 2, 
                    bgcolor: persona.name === 'Ayla' 
                      ? 'primary.light' 
                      : 'secondary.light',
                    color: '#fff',
                    borderRadius: 2,
                    mt: 2,
                    fontStyle: 'italic'
                  }}
                >
                  <Typography variant="body2">
                    {persona.name === 'Ayla' 
                      ? '"I hear you, and I\'m here with you. Let\'s explore what you\'re feeling together."'
                      : '"Let\'s look at this clearly. What\'s really going on, and what can we do about it?"'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleStartConversation}
          disabled={!selectedPersona || creating}
          sx={{ px: 4, py: 1.5 }}
        >
          {creating ? 'Creating Conversation...' : 'Start Conversation'}
        </Button>
      </Box>
    </Container>
  );
};

export default PersonaSelection;
