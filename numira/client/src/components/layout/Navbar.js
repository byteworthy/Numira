import React, { useContext, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  Container,
  Avatar,
  Button,
  Tooltip,
  MenuItem,
  Link,
  useTheme
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import PsychologyIcon from '@mui/icons-material/Psychology';
import { AuthContext } from '../../context/AuthContext';

const Navbar = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useContext(AuthContext);
  const [anchorElNav, setAnchorElNav] = useState(null);
  const [anchorElUser, setAnchorElUser] = useState(null);

  const handleOpenNavMenu = (event) => {
    setAnchorElNav(event.currentTarget);
  };
  
  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleLogout = () => {
    logout();
    handleCloseUserMenu();
    navigate('/');
  };

  const authLinks = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'New Conversation', path: '/personas' }
  ];

  const guestLinks = [
    { name: 'Login', path: '/login' },
    { name: 'Register', path: '/register' }
  ];

  const navLinks = isAuthenticated ? authLinks : guestLinks;

  const userMenuItems = [
    { name: 'Profile', action: () => navigate('/profile') },
    { name: 'Settings', action: () => navigate('/settings') },
    { name: 'Logout', action: handleLogout }
  ];

  return (
    <AppBar position="static" sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* Desktop Logo */}
          <PsychologyIcon sx={{ display: { xs: 'none', md: 'flex' }, mr: 1, color: theme.palette.primary.main }} />
          <Typography
            variant="h6"
            noWrap
            component={RouterLink}
            to="/"
            sx={{
              mr: 2,
              display: { xs: 'none', md: 'flex' },
              fontFamily: 'Quicksand, sans-serif',
              fontWeight: 700,
              letterSpacing: '.1rem',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            NUMIRA
          </Typography>

          {/* Mobile Menu */}
          <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
            <IconButton
              size="large"
              aria-label="menu"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorElNav}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{
                display: { xs: 'block', md: 'none' },
              }}
            >
              {navLinks.map((link) => (
                <MenuItem key={link.name} onClick={() => {
                  handleCloseNavMenu();
                  navigate(link.path);
                }}>
                  <Typography textAlign="center">{link.name}</Typography>
                </MenuItem>
              ))}
            </Menu>
          </Box>

          {/* Mobile Logo */}
          <PsychologyIcon sx={{ display: { xs: 'flex', md: 'none' }, mr: 1, color: theme.palette.primary.main }} />
          <Typography
            variant="h5"
            noWrap
            component={RouterLink}
            to="/"
            sx={{
              mr: 2,
              display: { xs: 'flex', md: 'none' },
              flexGrow: 1,
              fontFamily: 'Quicksand, sans-serif',
              fontWeight: 700,
              letterSpacing: '.1rem',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            NUMIRA
          </Typography>

          {/* Desktop Menu */}
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
            {navLinks.map((link) => (
              <Button
                key={link.name}
                component={RouterLink}
                to={link.path}
                onClick={handleCloseNavMenu}
                sx={{ my: 2, color: 'text.primary', display: 'block' }}
              >
                {link.name}
              </Button>
            ))}
          </Box>

          {/* User Menu (only when authenticated) */}
          {isAuthenticated && (
            <Box sx={{ flexGrow: 0 }}>
              <Tooltip title="Open settings">
                <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                  <Avatar 
                    alt={user?.name} 
                    src="/static/images/avatar/2.jpg" 
                    sx={{ bgcolor: theme.palette.primary.main }}
                  >
                    {user?.name?.charAt(0)}
                  </Avatar>
                </IconButton>
              </Tooltip>
              <Menu
                sx={{ mt: '45px' }}
                id="menu-appbar"
                anchorEl={anchorElUser}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorElUser)}
                onClose={handleCloseUserMenu}
              >
                {userMenuItems.map((item) => (
                  <MenuItem key={item.name} onClick={() => {
                    item.action();
                    handleCloseUserMenu();
                  }}>
                    <Typography textAlign="center">{item.name}</Typography>
                  </MenuItem>
                ))}
              </Menu>
            </Box>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Navbar;
