/**
 * A function that uses the modified spotify data to retrieve Youtube video Ids. These Ids are needed to POST the tracks into the Youtube playlist.
 * @param {String} accessToken The Google Auth Access Token required to make requests.
 * @param {Array} spotifyPlaylistData The formatted Spotify data to make the Youtube Search queries.
 * @returns {Promise}
 */
const getYoutubeVideoIds = async (accessToken, spotifyPlaylistData) => {
  try {
    const promises = spotifyPlaylistData.map(async trackObject => {
      const endpoint = `https://www.googleapis.com/youtube/v3/search/?order=relevance&type=video&maxResults=5&q=${encodeURIComponent(
        trackObject.track
      )}&part=snippet`;
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
      const body = res.json();
      return body;
    });
    const results = await Promise.all(promises);
    return results;
  } catch (err) {
    console.log(err);
  }
};

export default getYoutubeVideoIds;
