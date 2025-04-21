import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  Chip,
  IconButton,
  CircularProgress,
  useTheme
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import axios from 'axios';
import moment from 'moment';
import { AuthContext } from '../context/AuthContext';
import { AlertContext } from '../context/AlertContext';
import OnboardingManager from '../components/onboarding/OnboardingManager';

const Dashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { setAlert } = useContext(AlertContext);
  
  const [conversations, setConversations] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch conversations
        const conversationsRes = await axios.get('/api/conversations');
        setConversations(conversationsRes.data);
        
        // Fetch insights
        const insightsRes = await axios.get('/api/insights');
        setInsights(insightsRes.data);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setAlert('Failed to load dashboard data', 'error');
        setLoading(false);
      }
    };

    fetchData();
  }, [setAlert]);

  const handleStartNewConversation = () => {
    navigate('/personas');
  };

  const handleOpenConversation = (id) => {
    navigate(`/conversation/${id}`);
  };

  const handleDeleteConversation = async (id, e) => {
    e.stopPropagation();
    
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      try {
        await axios.delete(`/api/conversations/${id}`);
        setConversations(conversations.filter(conv => conv._id !== id));
        setAlert('Conversation deleted', 'success');
      } catch (err) {
        console.error('Error deleting conversation:', err);
        setAlert('Failed to delete conversation', 'error');
      }
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
    <>
      <OnboardingManager />
      <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Welcome Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome back, {user?.name}
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Continue an existing conversation or start a new one to explore your thoughts.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleStartNewConversation}
          sx={{ mt: 2 }}
        >
          New Conversation
        </Button>
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Recent Conversations */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Recent Conversations
        </Typography>
        
        {conversations.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              You haven't started any conversations yet.
            </Typography>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleStartNewConversation}
              sx={{ mt: 2 }}
            >
              Start Your First Conversation
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {conversations.slice(0, 6).map((conversation) => (
              <Grid item xs={12} sm={6} md={4} key={conversation._id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: theme.shadows[4]
                    }
                  }}
                  onClick={() => handleOpenConversation(conversation._id)}
                >
                  <Box 
                    sx={{ 
                      p: 2, 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      bgcolor: conversation.persona?.name === 'Ayla' 
                        ? 'primary.light' 
                        : 'secondary.light',
                      color: '#fff'
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                      {conversation.title}
                    </Typography>
                    <IconButton 
                      size="small" 
                      onClick={(e) => handleDeleteConversation(conversation._id, e)}
                      sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Chip 
                        label={conversation.persona?.name || 'AI'} 
                        size="small" 
                        sx={{ 
                          bgcolor: conversation.persona?.name === 'Ayla' 
                            ? 'primary.main' 
                            : 'secondary.main',
                          color: '#fff'
                        }} 
                      />
                      <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                        {moment(conversation.lastUpdated).fromNow()}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {conversation.messages && conversation.messages.length > 0
                        ? `${conversation.messages.length} messages`
                        : 'No messages yet'}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'flex-end', p: 2, pt: 0 }}>
                    <Button size="small" color="primary">
                      Continue
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
        
        {conversations.length > 6 && (
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Button variant="text" color="primary">
              View All Conversations
            </Button>
          </Box>
        )}
      </Box>

      {/* Recent Insights */}
      {insights.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" component="h2" gutterBottom>
            Recent Insights
          </Typography>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {insights.slice(0, 3).map((insight) => (
              <Grid item xs={12} sm={6} md={4} key={insight._id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <LightbulbIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                        Insight
                      </Typography>
                    </Box>
                    <Typography variant="body2" paragraph>
                      {insight.content}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 2 }}>
                      {insight.tags && insight.tags.map((tag, index) => (
                        <Chip key={index} label={tag} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'space-between', p: 2, pt: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      From: {insight.conversation?.title || 'Conversation'}
                    </Typography>
                    <Button 
                      size="small" 
                      color="primary"
                      onClick={() => navigate(`/conversation/${insight.conversation?._id}`)}
                    >
                      View Source
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Container>
    </>
  );
};

export default Dashboard;
