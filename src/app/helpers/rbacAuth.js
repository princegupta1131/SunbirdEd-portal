
let globalAuthToken = '';

function setAuthToken(token) {
  globalAuthToken = token;
}

function getAuthToken() {
  return globalAuthToken;
}

module.exports = {
  setAuthToken,
  getAuthToken,
};
