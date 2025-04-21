import React, { createContext, useReducer } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Create context
export const AlertContext = createContext();

// Initial state
const initialState = [];

// Reducer
const alertReducer = (state, action) => {
  const { type, payload } = action;

  switch (type) {
    case 'SET_ALERT':
      return [...state, payload];
    case 'REMOVE_ALERT':
      return state.filter(alert => alert.id !== payload);
    default:
      return state;
  }
};

// Provider component
export const AlertProvider = ({ children }) => {
  const [state, dispatch] = useReducer(alertReducer, initialState);

  // Set alert
  const setAlert = (msg, type, timeout = 5000) => {
    const id = uuidv4();
    dispatch({
      type: 'SET_ALERT',
      payload: { msg, type, id }
    });

    setTimeout(() => dispatch({ type: 'REMOVE_ALERT', payload: id }), timeout);
  };

  return (
    <AlertContext.Provider
      value={{
        alerts: state,
        setAlert
      }}
    >
      {children}
    </AlertContext.Provider>
  );
};
