/**
 * A function to generate appropriate queries for Youtube from Spotify's API data.
 * @param {Array} data An array of objects containing the raw track information from Spotify.
 * @returns {Array<object>}
 */
export const spotifyDataModifier = data => {
  const newData = data.map(dataObject => {
    const query = `${dataObject?.track?.name} ${dataObject?.track?.artists[0]?.name}`;
    return { track: query };
  });
  return newData;
};
