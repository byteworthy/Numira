import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Avatar,
  CircularProgress,
  IconButton,
  Divider,
  Chip,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  useTheme
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import axios from 'axios';
import moment from 'moment';
import { AuthContext } from '../context/AuthContext';
import { AlertContext } from '../context/AlertContext';
import OfflineStorage from '../utils/offlineStorage';
import { Capacitor } from '@capacitor/core';

const Conversation = () => {
  const theme = useTheme();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { setAlert } = useContext(AlertContext);
  
  const [conversation, setConversation] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineSnackbarOpen, setOfflineSnackbarOpen] = useState(false);
  
  const messagesEndRef = useRef(null);

  // Set up online/offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setAlert('You are back online', 'success');
    };
    
    const handleOffline = () => {
      setIsOffline(true);
      setOfflineSnackbarOpen(true);
    };
    
    OfflineStorage.setupConnectivityListeners(handleOnline, handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setAlert]);

  // Fetch conversation data
  useEffect(() => {
    const fetchConversation = async () => {
      try {
        // First try to get from local storage if on native platform
        if (Capacitor.isNativePlatform()) {
          const offlineConversation = await OfflineStorage.getConversation(id);
          if (offlineConversation) {
            setConversation(offlineConversation);
            setLoading(false);
          }
        }
        
        // If online, fetch from server
        if (navigator.onLine) {
          const res = await axios.get(`/api/conversations/${id}`);
          setConversation(res.data);
          
          // Save to offline storage if on native platform
          if (Capacitor.isNativePlatform()) {
            await OfflineStorage.saveConversation(res.data);
          }
          
          setLoading(false);
        } else if (!conversation && Capacitor.isNativePlatform()) {
          // If offline and no conversation found in storage
          setAlert('You are offline and this conversation is not available locally', 'warning');
          setLoading(false);
          navigate('/dashboard');
        } else if (!conversation) {
          // If offline and not on native platform
          setAlert('You are offline. Please connect to the internet to view conversations.', 'error');
          setLoading(false);
          navigate('/dashboard');
        }
      } catch (err) {
        console.error('Error fetching conversation:', err);
        setAlert('Failed to load conversation', 'error');
        setLoading(false);
        navigate('/dashboard');
      }
    };

    fetchConversation();
  }, [id, setAlert, navigate, conversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation?.messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    setSending(true);
    
    // If offline and on native platform, save message locally
    if (isOffline && Capacitor.isNativePlatform()) {
      try {
        await OfflineStorage.saveOfflineMessage(id, message.trim());
        
        // Update local state to show the message immediately
        setConversation(prev => {
          if (!prev) return prev;
          
          return {
            ...prev,
            messages: [
              ...prev.messages,
              {
                content: message.trim(),
                role: 'user',
                timestamp: Date.now(),
                offline: true
              }
            ]
          };
        });
        
        setMessage('');
        setAlert('Message saved for sending when online', 'info');
      } catch (err) {
        console.error('Error saving offline message:', err);
        setAlert('Failed to save message for offline use', 'error');
      } finally {
        setSending(false);
      }
      return;
    }
    
    // If online, send message to server
    try {
      // Add user message to conversation
      const res = await axios.post('/api/ai/respond', {
        conversationId: id,
        message: message.trim()
      });
      
      setConversation(res.data);
      
      // Save to offline storage if on native platform
      if (Capacitor.isNativePlatform()) {
        await OfflineStorage.saveConversation(res.data);
      }
      
      setMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
      setAlert('Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleOpenMenu = (event) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
  };

  const handleGenerateInsights = async () => {
    handleCloseMenu();
    setGeneratingInsights(true);
    
    try {
      const res = await axios.post('/api/ai/insights', {
        conversationId: id
      });
      
      if (res.data && res.data.length > 0) {
        setAlert('Insights generated successfully', 'success');
      } else {
        setAlert('No insights could be generated from this conversation', 'info');
      }
    } catch (err) {
      console.error('Error generating insights:', err);
      setAlert('Failed to generate insights', 'error');
    } finally {
      setGeneratingInsights(false);
    }
  };

  const handleDeleteConversation = async () => {
    handleCloseMenu();
    
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      try {
        await axios.delete(`/api/conversations/${id}`);
        setAlert('Conversation deleted', 'success');
        navigate('/dashboard');
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

  const isAyla = conversation?.persona?.name === 'Ayla';
  const personaColor = isAyla ? 'primary' : 'secondary';

  const handleCloseOfflineSnackbar = () => {
    setOfflineSnackbarOpen(false);
  };

  return (
    <Container maxWidth="md" sx={{ py: 2, height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      {/* Offline indicator */}
      <Snackbar
        open={offlineSnackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseOfflineSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseOfflineSnackbar} 
          severity="warning" 
          sx={{ width: '100%' }}
          icon={<WifiOffIcon />}
        >
          You are offline. Some features may be limited.
        </Alert>
      </Snackbar>
      {/* Conversation Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            color="inherit" 
            onClick={() => navigate('/dashboard')}
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="h1">
            {conversation.title}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Chip 
            label={conversation.persona?.name || 'AI'} 
            color={personaColor}
            sx={{ mr: 1 }}
          />
          
          <IconButton 
            aria-label="conversation menu" 
            aria-controls="conversation-menu"
            aria-haspopup="true"
            onClick={handleOpenMenu}
          >
            <MoreVertIcon />
          </IconButton>
          <Menu
            id="conversation-menu"
            anchorEl={menuAnchorEl}
            keepMounted
            open={Boolean(menuAnchorEl)}
            onClose={handleCloseMenu}
          >
            <MenuItem 
              onClick={handleGenerateInsights}
              disabled={generatingInsights || conversation.messages.length < 3}
            >
              {generatingInsights ? 'Generating...' : 'Generate Insights'}
            </MenuItem>
            <MenuItem onClick={handleDeleteConversation}>Delete Conversation</MenuItem>
          </Menu>
        </Box>
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      {/* Messages Container */}
      <Box 
        sx={{ 
          flexGrow: 1, 
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          p: 2,
          bgcolor: 'background.default',
          borderRadius: 2
        }}
      >
        {conversation.messages.length === 0 ? (
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              color: 'text.secondary'
            }}
          >
            <Typography variant="h6" gutterBottom>
              Start a conversation with {conversation.persona?.name}
            </Typography>
            <Typography variant="body2">
              {isAyla 
                ? 'Share what\'s on your mind, and Ayla will respond with empathy and understanding.'
                : 'Share what\'s on your mind, and Cam will help you gain clarity and perspective.'}
            </Typography>
          </Box>
        ) : (
          conversation.messages.map((msg, index) => (
            <Box 
              key={index}
              sx={{ 
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                mb: 2
              }}
            >
              <Avatar 
                sx={{ 
                  bgcolor: msg.role === 'user' 
                    ? 'grey.300' 
                    : theme.palette[personaColor].main,
                  color: msg.role === 'user' ? 'text.primary' : '#fff',
                  ml: msg.role === 'user' ? 1 : 0,
                  mr: msg.role === 'user' ? 0 : 1
                }}
              >
                {msg.role === 'user' 
                  ? user?.name?.charAt(0) || 'U'
                  : conversation.persona?.name?.charAt(0) || 'A'}
              </Avatar>
              
              <Paper 
                elevation={1}
                sx={{ 
                  p: 2,
                  maxWidth: '75%',
                  bgcolor: msg.role === 'user' 
                    ? 'background.paper' 
                    : theme.palette[personaColor].light,
                  color: msg.role === 'user' 
                    ? 'text.primary' 
                    : '#fff',
                  borderRadius: msg.role === 'user'
                    ? '16px 16px 4px 16px'
                    : '16px 16px 16px 4px'
                }}
              >
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    display: 'block', 
                    mt: 1,
                    textAlign: 'right',
                    opacity: 0.8
                  }}
                >
                  {moment(msg.timestamp).format('h:mm A')}
                </Typography>
              </Paper>
            </Box>
          ))
        )}
        <div ref={messagesEndRef} />
      </Box>
      
      {/* Message Input */}
      <Box 
        component="form" 
        onSubmit={handleSendMessage}
        sx={{ 
          mt: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          position: 'relative'
        }}
      >
        {isOffline && (
          <Box 
            sx={{ 
              position: 'absolute', 
              top: -24, 
              left: 0, 
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              color: 'warning.main',
              bgcolor: 'warning.light',
              py: 0.5,
              px: 2,
              borderRadius: 1,
              fontSize: '0.75rem'
            }}
          >
            <WifiOffIcon fontSize="small" />
            <Typography variant="caption">
              {Capacitor.isNativePlatform() 
                ? 'Offline mode: Messages will be sent when you reconnect' 
                : 'You are offline. Connect to send messages.'}
            </Typography>
          </Box>
        )}
        <TextField
          fullWidth
          variant="outlined"
          placeholder={`Message ${conversation.persona?.name || 'AI'}...`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={sending || (isOffline && !Capacitor.isNativePlatform())}
          multiline
          maxRows={4}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 4,
              bgcolor: 'background.paper'
            },
            // Increase touch target area for mobile
            '& .MuiInputBase-input': {
              py: Capacitor.isNativePlatform() ? 1.5 : 1,
              px: Capacitor.isNativePlatform() ? 2 : 1.5
            }
          }}
        />
        <Button
          variant="contained"
          color={personaColor}
          disabled={!message.trim() || sending || (isOffline && !Capacitor.isNativePlatform())}
          type="submit"
          sx={{ 
            borderRadius: '50%', 
            minWidth: 'auto',
            width: Capacitor.isNativePlatform() ? 64 : 56,
            height: Capacitor.isNativePlatform() ? 64 : 56,
            p: 0
          }}
        >
          {sending ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            <SendIcon />
          )}
        </Button>
      </Box>
    </Container>
  );
};

export default Conversation;
