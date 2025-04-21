import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Avatar,
  Button,
  TextField,
  Grid,
  FormControl,
  FormLabel,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  InputLabel,
  Divider,
  CircularProgress,
  useTheme
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SaveIcon from '@mui/icons-material/Save';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { AlertContext } from '../context/AlertContext';

const Profile = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, updateUserPreferences, loadUser } = useContext(AuthContext);
  const { setAlert } = useContext(AlertContext);
  
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    theme: 'light',
    defaultPersona: '',
    notificationsEnabled: true
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch personas
        const personasRes = await axios.get('/api/personas');
        setPersonas(personasRes.data);
        
        // Set form data from user preferences
        if (user?.preferences) {
          setFormData({
            theme: user.preferences.theme || 'light',
            defaultPersona: user.preferences.defaultPersona || '',
            notificationsEnabled: 
              user.preferences.notificationsEnabled !== undefined 
                ? user.preferences.notificationsEnabled 
                : true
          });
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching profile data:', err);
        setAlert('Failed to load profile data', 'error');
        setLoading(false);
      }
    };

    fetchData();
  }, [user, setAlert]);

  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'notificationsEnabled' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await updateUserPreferences(formData);
      setAlert('Profile updated successfully', 'success');
      // Reload user data to get updated preferences
      await loadUser();
    } catch (err) {
      console.error('Error updating profile:', err);
      setAlert('Failed to update profile', 'error');
    } finally {
      setSaving(false);
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
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <Avatar
            sx={{ 
              width: 80, 
              height: 80, 
              bgcolor: theme.palette.primary.main,
              mr: 3
            }}
          >
            {user?.name?.charAt(0) || <PersonIcon fontSize="large" />}
          </Avatar>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {user?.name}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {user?.email}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Member since {new Date(user?.date).toLocaleDateString()}
            </Typography>
          </Box>
        </Box>
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="h5" component="h2" gutterBottom>
          Preferences
        </Typography>
        
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="theme-label">Theme</InputLabel>
                <Select
                  labelId="theme-label"
                  id="theme"
                  name="theme"
                  value={formData.theme}
                  onChange={handleChange}
                  label="Theme"
                >
                  <MenuItem value="light">Light</MenuItem>
                  <MenuItem value="dark">Dark</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="persona-label">Default Persona</InputLabel>
                <Select
                  labelId="persona-label"
                  id="defaultPersona"
                  name="defaultPersona"
                  value={formData.defaultPersona}
                  onChange={handleChange}
                  label="Default Persona"
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {personas.map(persona => (
                    <MenuItem key={persona._id} value={persona._id}>
                      {persona.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.notificationsEnabled}
                    onChange={handleChange}
                    name="notificationsEnabled"
                    color="primary"
                  />
                }
                label="Enable Notifications"
              />
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              disabled={saving}
              sx={{ py: 1.5, px: 3 }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Box>
      </Paper>
      
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2, mt: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Account Statistics
        </Typography>
        
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h3" color="primary">
                {user?.conversations?.length || 0}
              </Typography>
              <Typography variant="body1">Conversations</Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h3" color="primary">
                {user?.insights?.length || 0}
              </Typography>
              <Typography variant="body1">Insights</Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h3" color="primary">
                {user?.messages?.length || 0}
              </Typography>
              <Typography variant="body1">Messages</Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default Profile;
