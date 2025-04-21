import { createTheme } from '@mui/material/styles';

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#8A6FDF',
      light: '#A18BE6',
      dark: '#6F58B3',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#5EBFB5',
      light: '#7FCCC3',
      dark: '#4A9990',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F8F9FC',
      paper: '#FFFFFF',
      card: '#FFFFFF',
      dialog: '#FFFFFF',
    },
    text: {
      primary: '#2D3748',
      secondary: '#718096',
      disabled: '#A0AEC0',
      hint: '#A0AEC0',
    },
    error: {
      main: '#E53E3E',
      light: '#FC8181',
      dark: '#C53030',
    },
    warning: {
      main: '#ED8936',
      light: '#FBD38D',
      dark: '#DD6B20',
    },
    info: {
      main: '#4299E1',
      light: '#BEE3F8',
      dark: '#3182CE',
    },
    success: {
      main: '#48BB78',
      light: '#9AE6B4',
      dark: '#2F855A',
    },
    divider: 'rgba(0, 0, 0, 0.08)',
    // Custom colors for light theme
    custom: {
      menuBackground: '#FFFFFF',
      cardHover: '#F7FAFC',
      inputBackground: '#F7FAFC',
      border: 'rgba(0, 0, 0, 0.08)',
      shadow: 'rgba(0, 0, 0, 0.1)',
      overlay: 'rgba(255, 255, 255, 0.8)',
      highlight: 'rgba(138, 111, 223, 0.1)',
    },
  },
  typography: {
    fontFamily: '"Quicksand", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontFamily: '"Quicksand", sans-serif',
      fontWeight: 700,
      fontSize: '2.5rem',
    },
    h2: {
      fontFamily: '"Quicksand", sans-serif',
      fontWeight: 700,
      fontSize: '2rem',
    },
    h3: {
      fontFamily: '"Quicksand", sans-serif',
      fontWeight: 600,
      fontSize: '1.75rem',
    },
    h4: {
      fontFamily: '"Quicksand", sans-serif',
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h5: {
      fontFamily: '"Quicksand", sans-serif',
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    h6: {
      fontFamily: '"Quicksand", sans-serif',
      fontWeight: 600,
      fontSize: '1rem',
    },
    subtitle1: {
      fontFamily: '"Inter", sans-serif',
      fontWeight: 500,
      fontSize: '1rem',
    },
    subtitle2: {
      fontFamily: '"Inter", sans-serif',
      fontWeight: 500,
      fontSize: '0.875rem',
    },
    body1: {
      fontFamily: '"Inter", sans-serif',
      fontWeight: 400,
      fontSize: '1rem',
    },
    body2: {
      fontFamily: '"Inter", sans-serif',
      fontWeight: 400,
      fontSize: '0.875rem',
    },
    button: {
      fontFamily: '"Inter", sans-serif',
      fontWeight: 600,
      fontSize: '0.875rem',
      textTransform: 'none',
    },
    caption: {
      fontFamily: '"Inter", sans-serif',
      fontWeight: 400,
      fontSize: '0.75rem',
    },
    overline: {
      fontFamily: '"Inter", sans-serif',
      fontWeight: 400,
      fontSize: '0.625rem',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
    },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    'none',
    '0px 2px 4px rgba(0, 0, 0, 0.05)',
    '0px 4px 8px rgba(0, 0, 0, 0.05)',
    '0px 6px 12px rgba(0, 0, 0, 0.05)',
    '0px 8px 16px rgba(0, 0, 0, 0.05)',
    '0px 10px 20px rgba(0, 0, 0, 0.05)',
    '0px 12px 24px rgba(0, 0, 0, 0.05)',
    '0px 14px 28px rgba(0, 0, 0, 0.05)',
    '0px 16px 32px rgba(0, 0, 0, 0.05)',
    '0px 18px 36px rgba(0, 0, 0, 0.05)',
    '0px 20px 40px rgba(0, 0, 0, 0.05)',
    '0px 22px 44px rgba(0, 0, 0, 0.05)',
    '0px 24px 48px rgba(0, 0, 0, 0.05)',
    '0px 26px 52px rgba(0, 0, 0, 0.05)',
    '0px 28px 56px rgba(0, 0, 0, 0.05)',
    '0px 30px 60px rgba(0, 0, 0, 0.05)',
    '0px 32px 64px rgba(0, 0, 0, 0.05)',
    '0px 34px 68px rgba(0, 0, 0, 0.05)',
    '0px 36px 72px rgba(0, 0, 0, 0.05)',
    '0px 38px 76px rgba(0, 0, 0, 0.05)',
    '0px 40px 80px rgba(0, 0, 0, 0.05)',
    '0px 42px 84px rgba(0, 0, 0, 0.05)',
    '0px 44px 88px rgba(0, 0, 0, 0.05)',
    '0px 46px 92px rgba(0, 0, 0, 0.05)',
    '0px 48px 96px rgba(0, 0, 0, 0.05)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#CBD5E0 #EDF2F7',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            backgroundColor: '#EDF2F7',
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 8,
            backgroundColor: '#CBD5E0',
            minHeight: 24,
          },
          '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus': {
            backgroundColor: '#A0AEC0',
          },
          '&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active': {
            backgroundColor: '#A0AEC0',
          },
          '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
            backgroundColor: '#A0AEC0',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(45deg, #8A6FDF 30%, #9F7CF1 90%)',
          '&:hover': {
            background: 'linear-gradient(45deg, #7A62C7 30%, #8F6FD9 90%)',
          },
        },
        containedSecondary: {
          background: 'linear-gradient(45deg, #5EBFB5 30%, #6FD9CE 90%)',
          '&:hover': {
            background: 'linear-gradient(45deg, #4EA69D 30%, #5EBFB5 90%)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.05)',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0px 8px 30px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: '#F7FAFC',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(138, 111, 223, 0.5)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#8A6FDF',
            },
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
          backgroundImage: 'linear-gradient(90deg, #FFFFFF 0%, #F8F9FC 100%)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#FFFFFF',
          backgroundImage: 'linear-gradient(180deg, #FFFFFF 0%, #F8F9FC 100%)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          boxShadow: '0px 8px 30px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
        colorPrimary: {
          backgroundColor: 'rgba(138, 111, 223, 0.1)',
          color: '#8A6FDF',
        },
        colorSecondary: {
          backgroundColor: 'rgba(94, 191, 181, 0.1)',
          color: '#5EBFB5',
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '&.Mui-selected': {
            backgroundColor: 'rgba(138, 111, 223, 0.1)',
            '&:hover': {
              backgroundColor: 'rgba(138, 111, 223, 0.2)',
            },
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          width: 42,
          height: 26,
          padding: 0,
          margin: 8,
        },
        switchBase: {
          padding: 1,
          '&.Mui-checked': {
            transform: 'translateX(16px)',
            color: '#fff',
            '& + .MuiSwitch-track': {
              backgroundColor: '#8A6FDF',
              opacity: 1,
              border: 'none',
            },
          },
          '&.Mui-focusVisible .MuiSwitch-thumb': {
            color: '#8A6FDF',
            border: '6px solid #fff',
          },
        },
        thumb: {
          width: 24,
          height: 24,
        },
        track: {
          borderRadius: 26 / 2,
          backgroundColor: '#E2E8F0',
          opacity: 1,
        },
      },
    },
  },
});

export default lightTheme;
