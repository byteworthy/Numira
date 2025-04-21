import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Grid,
  Typography,
  Card,
  CardContent,
  CardMedia,
  useTheme
} from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import MoodIcon from '@mui/icons-material/Mood';
import InsightsIcon from '@mui/icons-material/Insights';
import { AuthContext } from '../context/AuthContext';

const Landing = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { isAuthenticated } = useContext(AuthContext);

  useEffect(() => {
    // Redirect if already authenticated
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const features = [
    {
      title: 'Personalized Guidance',
      description: 'Choose from different AI personas that match your preferred style of reflection and support.',
      icon: <PsychologyIcon sx={{ fontSize: 60, color: theme.palette.primary.main }} />
    },
    {
      title: 'Emotional Clarity',
      description: 'Process your thoughts and feelings in a safe, supportive environment designed for mental wellness.',
      icon: <MoodIcon sx={{ fontSize: 60, color: theme.palette.primary.main }} />
    },
    {
      title: 'Meaningful Insights',
      description: 'Discover patterns and gain valuable insights from your conversations to support personal growth.',
      icon: <InsightsIcon sx={{ fontSize: 60, color: theme.palette.primary.main }} />
    }
  ];

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: 'calc(100vh - 64px)' }}>
      {/* Hero Section */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          pt: 8,
          pb: 6,
          borderBottom: `1px solid ${theme.palette.divider}`
        }}
      >
        <Container maxWidth="md">
          <Typography
            component="h1"
            variant="h2"
            align="center"
            color="text.primary"
            gutterBottom
            sx={{ 
              fontWeight: 700, 
              fontFamily: 'Quicksand, sans-serif',
              mb: 4
            }}
          >
            Find Clarity Through Conversation
          </Typography>
          <Typography
            variant="h5"
            align="center"
            color="text.secondary"
            paragraph
            sx={{ mb: 4 }}
          >
            Numira is your AI-powered mental clarity companion. Process your thoughts, explore your feelings, and gain insights through thoughtful conversations with personalized AI guides.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 4 }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={() => navigate('/register')}
              sx={{ px: 4, py: 1.5, borderRadius: 2 }}
            >
              Get Started
            </Button>
            <Button
              variant="outlined"
              color="primary"
              size="large"
              onClick={() => navigate('/login')}
              sx={{ px: 4, py: 1.5, borderRadius: 2 }}
            >
              Login
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Features Section */}
      <Container sx={{ py: 8 }} maxWidth="lg">
        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item key={index} xs={12} sm={6} md={4}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 4,
                  transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 12px 20px rgba(0, 0, 0, 0.1)'
                  }
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    p: 3
                  }}
                >
                  {feature.icon}
                </Box>
                <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                  <Typography gutterBottom variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                    {feature.title}
                  </Typography>
                  <Typography color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 3,
          px: 2,
          mt: 'auto',
          backgroundColor: theme.palette.background.paper,
          borderTop: `1px solid ${theme.palette.divider}`
        }}
      >
        <Container maxWidth="sm">
          <Typography variant="body2" color="text.secondary" align="center">
            © {new Date().getFullYear()} Numira. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default Landing;
