/**
 * A recursive function that accepts a single track and makes repeated calls to the endpoint until the response is successful.
 * @param {String} accessToken The Google Auth Access Token required to make POST requests.
 * @param {Object} resourceId The Youtube track to POST into the Youtube playlist.
 * @param {String} playlistId The playlistId of what playlist to POST the tracks to.
 */
const postYoutubeTrack = async (accessToken, singleResourceId, playlistId) => {
  const request = await fetch(`https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      snippet: {
        playlistId: playlistId,
        resourceId: {
          kind: singleResourceId.kind,
          videoId: singleResourceId.videoId,
        },
      },
    }),
  });

  const response = await request.json();
  return response;
};

export default postYoutubeTrack;
