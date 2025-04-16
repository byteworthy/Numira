import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Container, Typography, Button, useTheme } from '@mui/material';
import SentimentDissatisfiedIcon from '@mui/icons-material/SentimentDissatisfied';
import HomeIcon from '@mui/icons-material/Home';

const NotFound = () => {
  const theme = useTheme();

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 64px)',
          textAlign: 'center',
          py: 8
        }}
      >
        <SentimentDissatisfiedIcon
          sx={{ fontSize: 100, color: theme.palette.primary.main, mb: 4 }}
        />
        <Typography variant="h2" component="h1" gutterBottom>
          404
        </Typography>
        <Typography variant="h4" component="h2" gutterBottom>
          Page Not Found
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph sx={{ maxWidth: 500, mb: 4 }}>
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          component={RouterLink}
          to="/"
          startIcon={<HomeIcon />}
          size="large"
          sx={{ py: 1.5, px: 4 }}
        >
          Back to Home
        </Button>
      </Box>
    </Container>
  );
};

export default NotFound;
