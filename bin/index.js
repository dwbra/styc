#! /usr/bin/env node
import yargs from 'yargs';
import http from 'http';
import url from 'node:url';
import { hideBin } from 'yargs/helpers';
import { google } from 'googleapis';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import ora from 'ora';
import { fetchBearer, fetchPlaylistTracks, fetchOffsetTracks } from '../src/api/getSpotifyTracks.js';
import { spotifyDataModifier } from '../src/helpers/spotifyHelpers.js';
import getYoutubeVideoIds from '../src/api/getYoutubeVideoIds.js';
import { youtubeSearchModifier } from '../src/helpers/youtubeHelpers.js';
import postYoutubeTrack from '../src/api/postYoutubeTracks.js';

const spinner = ora();

const argv = yargs(hideBin(process.argv))
  .scriptName('styc')
  .usage(
    `\nUsage: styc --sc="keyValue" --scs="keyValue" --s="keyValue" --yp="keyValue" --gc="keyValue" --gs="keyValue" --gu="http://localhost:8080/oauth2callback" --gm="email@email.com" --gp="emailPassword"`
  )
  .options({
    s: {
      alias: 'spotify',
      demandOption: true,
      describe: 'The spotify playlistId you wish to retrieve.',
      type: 'string',
    },
    yp: {
      alias: 'youtubePlaylist',
      demandOption: true,
      describe: 'The youTube playlistId you wish to push the spotify songs into.',
      type: 'string',
    },
    sc: {
      alias: 'spotifyClientId',
      demandOption: true,
      describe: "The clientId api key needed to use Spotify's API.",
      type: 'string',
    },
    scs: {
      alias: 'spotifyClientSecret',
      demandOption: true,
      describe: "The clientSecret api key needed to use Spotify's API.",
      type: 'string',
    },
    gc: {
      alias: 'googleClientId',
      demandOption: true,
      describe: 'The clientId',
      type: 'string',
    },
    gs: {
      alias: 'googleClientSecret',
      demandOption: true,
      describe: 'The client secret',
      type: 'string',
    },
    gu: {
      alias: 'googleUri',
      demandOption: true,
      describe: 'The uri',
      type: 'string',
    },
    gm: {
      alias: 'gmail',
      demandOption: true,
      describe: 'The uri',
      type: 'string',
    },
    gp: {
      alias: 'gmailPw',
      demandOption: true,
      describe: 'The uri',
      type: 'string',
    },
  }).argv;

const youtubePlaylist = argv.yp || argv.youtubePlaylist;
const googleClientId = argv.gc || argv.googleClientId;
const googleClientSecret = argv.gs || argv.googleClientSecret;
const googleUri = argv.gu || argv.googleUri;
const googleEmail = argv.gm || argv.gmail;
const googlePassword = argv.gp || argv.gmailPw;

const spotifyPlaylist = argv.s || argv.spotify;
const spotifyClientId = argv.sc || argv.spotifyClientId;
const spotifyClientSecret = argv.scs || argv.spotifyClientSecret;

let getSpotifyBearerToken = '';
let spotifyPlaylistStore = [];
let spotifyNext = null;
let modifiedSpotifyData = [];

let googleAuthCredentials = null;

const oauth2Client = new google.auth.OAuth2(googleClientId, googleClientSecret, googleUri);

const scopes = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/youtubepartner',
];

// Generate a url that asks permissions
const authorizationUrl = oauth2Client.generateAuthUrl({
  // 'online' (default) or 'offline' (gets refresh_token)
  access_type: 'offline',
  /** Pass in the scopes array defined above.
   * Alternatively, if only one scope is needed, you can pass a scope URL as a string */
  scope: scopes,
  // Enable incremental authorization. Recommended as a best practice.
  include_granted_scopes: true,
});

const server = http
  .createServer(async function (req, res) {
    // Example on redirecting user to Google's OAuth 2.0 server.
    if (req.url == '/') {
      res.writeHead(301, { Location: authorizationUrl });
    }

    // Receive the callback from Google's OAuth 2.0 server.
    if (req.url.startsWith('/oauth2callback')) {
      // Handle the OAuth 2.0 server response
      let q = url.parse(req.url, true).query;

      if (q.error) {
        // An error response e.g. error=access_denied
        console.log('Error:' + q.error);
      } else {
        // Get access and refresh tokens (if access_type is offline)
        let { tokens } = await oauth2Client.getToken(q.code);
        oauth2Client.setCredentials(tokens);

        /** Save credential to the global variable in case access token was refreshed.
         * ACTION ITEM: In a production app, you likely want to save the refresh token
         * in a secure persistent database instead. */
        googleAuthCredentials = tokens;
        // console.log(googleAuthCredentials);
        res.write('Tokens set.');
      }
    }
    res.end();
  })
  .listen(8080);

/**
 * A function to generate an OAuth token from Google.
 */
const googleAuth = async () => {
  // We need to use this to get around Google not liking programatic authing.
  puppeteer.use(StealthPlugin());

  //Due to MFA we need to use a browser window to be able to enter codes etc.
  spinner.start('Running Google Auth - Launching browser');
  const browser = await puppeteer.launch({ headless: false });
  spinner.succeed();
  spinner.start('Opening page');
  const page = await browser.newPage();
  spinner.succeed();

  spinner.start('Setting language types');
  await page.setExtraHTTPHeaders({
    'accept-language': 'en-US,en;q=0.9,hy;q=0.8',
  });
  spinner.succeed();

  spinner.start('Loading your custom Google Auth Url');
  await page.goto(authorizationUrl);
  spinner.succeed();

  spinner.start('Entering your email');
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', googleEmail);

  await Promise.all([page.waitForNavigation(), await page.keyboard.press('Enter')]);
  spinner.succeed();

  spinner.start('Entering your password');
  await page.waitForSelector('input[type="password"]', { visible: true });
  await page.type('input[type="password"]', googlePassword);

  await Promise.all([page.waitForNavigation(), await page.keyboard.press('Enter')]);
  spinner.succeed();

  spinner.start('Waiting for URI redirect page to load. You may need to confirm via MFA.');
  await page.waitForSelector('pre', { visible: true });
  spinner.succeed();

  spinner.start('Tokens are set. Server and browser are closing');
  await browser.close();
  server.close();
  spinner.succeed();
};

/**
 * A function to generate a Bearer token from Spotify.
 */
const spotifyAuth = async () => {
  spinner.start('Running Spotify authentication process');
  getSpotifyBearerToken = await fetchBearer(spotifyClientId, spotifyClientSecret);
  spinner.succeed();
};

/**
 * A function that handles fetching the spotify playlist tracks and sanitizing it into usable queries.
 * @param {Promise} recursiveCallback A callback function that operates as a recursive.
 * @returns {Promise}
 */
const spotifyHandler = async recursiveCallback => {
  spinner.start('Getting Spotify playlist and formatting data for youtube');
  const getSpotifyPlaylistTracks = await fetchPlaylistTracks(getSpotifyBearerToken, spotifyPlaylist);

  spotifyNext = getSpotifyPlaylistTracks?.tracks?.next;
  spotifyPlaylistStore = [...getSpotifyPlaylistTracks?.tracks?.items];

  modifiedSpotifyData = spotifyDataModifier(spotifyPlaylistStore);

  if (!!spotifyNext) {
    await recursiveCallback(fetchOffsetTracks(getSpotifyBearerToken, spotifyNext));
  }

  if (modifiedSpotifyData.length < 20) {
    spinner.succeed();
    return;
  }

  //Modify array length due to youtubes API limits.
  modifiedSpotifyData.length = 20;
  spinner.succeed();
};

/**
 * A function that handles fetching the Youtube Video Id's, sanitizing them and then POSTing them to the designated Youtube playlist.
 * @returns {Promise}
 */
const youtubeHandler = async () => {
  spinner.start('Running Youtube searches & transforming data');
  const youtubeVideoIds = await getYoutubeVideoIds(googleAuthCredentials.access_token, modifiedSpotifyData);

  if (youtubeVideoIds[0].error) {
    spinner.fail();
    console.log(youtubeVideoIds[0].error);
    return;
  }

  const sanitizedIds = youtubeSearchModifier(youtubeVideoIds);
  spinner.succeed();

  /**
   * Create a generator function with a list of yielded async functions. Each yielded function contains a different track to POST into the Youtube playlist.
   */
  async function* postTracks() {
    for (const track of sanitizedIds) {
      yield await postYoutubeTrack(googleAuthCredentials.access_token, track, youtubePlaylist);
    }
  }

  // Create the generator object
  const postRequestResultData = postTracks();

  spinner.info(
    'Please wait while the tracks are being added... The application will return successful once all of the tracks have been added.'
  );
  // Loop over the array of sanitizedIds and call .next() on the generator function to POST the next track.
  for (let i = 0; i < sanitizedIds.length; i++) {
    spinner.start('Adding track...');
    postRequestResultData.next();
    // Wait 4s after each request to ensure we don't hit API errors.
    await new Promise(r => setTimeout(r, 4000));
    spinner.succeed('Track added!');
  }
};

/**
 * This function would handle large spotify playlists if Youtube allowed larger daily Quota limits.
 * @param {Promise} callback A callback function that returns a promise.
 * @returns {Void}
 */
const spotifyRecursive = async callback => {
  const getPlaylist = await callback;

  if (!!spotifyNext) {
    spotifyPlaylistStore = [...spotifyPlaylistStore, ...getPlaylist?.items];
    spotifyNext = getPlaylist?.tracks?.next;
    spotifyRecursive();
  }

  return;
};

const callStack = async () => {
  await googleAuth();
  await spotifyAuth();
  await spotifyHandler(spotifyRecursive);
  await youtubeHandler();
};
callStack();
