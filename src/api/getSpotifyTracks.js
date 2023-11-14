/**
 * A function to fetch a bearer token from Spotify to make subsequent requests.
 * @param {String} clientId Spotify clientId needed to get a bearer token.
 * @param {String} clientSecret Spotify clientSecret needed to get a bearer token.
 * @returns {Promise}
 */
export const fetchBearer = async (clientId, clientSecret) => {
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
    });
    const body = await response.json();
    return body?.access_token;
  } catch (err) {
    console.log(err);
  }
};

/**
 * A function to fetch all of the playlist tracks.
 * @param {String} bearerToken Token required to make API calls.
 * @param {String} playlistId Playlist that you wish to retrieve.
 * @returns {Promise}
 */
export const fetchPlaylistTracks = async (bearerToken, playlistId) => {
  const endpoint = `https://api.spotify.com/v1/playlists/${playlistId}/`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    });
    const body = await response.json();
    return body;
  } catch (err) {
    console.log(err);
  }
};

/**
 * A function to help make offset fetch requests if the Spotify playlist contains over 100 tracks which is the API call limit.
 * @param {String} bearerToken Token required to make API calls.
 * @param {String} endpoint The paginated next endpoint.
 * @returns {Promise}
 */
export const fetchOffsetTracks = async (bearerToken, endpoint) => {
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    });
    const body = await response.json();
    return body;
  } catch (err) {
    console.log(err);
  }
};
