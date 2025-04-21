import React, { useContext } from 'react';
import { AlertContext } from '../../context/AlertContext';
import { Alert as MuiAlert, Snackbar, Stack } from '@mui/material';

const Alert = () => {
  const { alerts } = useContext(AlertContext);

  if (alerts.length === 0) return null;

  return (
    <Stack spacing={2} sx={{ width: '100%', position: 'fixed', top: 64, zIndex: 1000 }}>
      {alerts.map((alert) => (
        <Snackbar
          key={alert.id}
          open={true}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <MuiAlert
            elevation={6}
            variant="filled"
            severity={alert.type}
            sx={{ width: '100%' }}
          >
            {alert.msg}
          </MuiAlert>
        </Snackbar>
      ))}
    </Stack>
  );
};

export default Alert;
