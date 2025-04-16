import axios from 'axios';

/**
 * Sets or removes the authentication token in axios headers
 * @param {string} token - JWT token
 */
const setAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common['x-auth-token'] = token;
  } else {
    delete axios.defaults.headers.common['x-auth-token'];
  }
};

export default setAuthToken;
