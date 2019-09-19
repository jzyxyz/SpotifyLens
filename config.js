const inquirer = require('inquirer')

const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-library-modify',
  'user-read-email',
  'user-library-read',
  'playlist-read-private',
  'user-top-read',
  'user-read-currently-playing',
  'user-modify-playback-state',
]

let cnt = 0
const PROMPT = {
  type: 'list',
  name: 'operations',
  message: 'What do you like me to do?',
  choices: [
    '  Add current playing to my library',
    '  Skip to next track',
    '--',
    '  Export all tracks from my library.',
    '  Export an ordered & ranked artists list. (based on a certain playlist)',
    '  List all playlists with its id',
    '  Export top 50 artists (according to Spotify)',
    '  Export top 50 tracks (according to Spotify)',
    '  Export genre data',
    '  Export genre data (tokenized)',
    '--',
    '  Exit',
  ].map((el, idx) => {
    if (el === '--') {
      cnt += 1
      return new inquirer.Separator()
    } else {
      return `#${idx - cnt} ${el}`
    }
  }),
}

const PRUNE_PLAYLIST_KEYS = [
  'external_urls',
  'collaborative',
  'owner',
  'public',
  'snapshot_id',
]

const PRUNE_TRACK_KEYS = [
  'album',
  'available_markets',
  'disc_number',
  'duration_ms',
  'explicit',
  'external_ids',
  'external_urls',
  'owner',
  'public',
  'is_playable',
  'linked_from',
  'restrictions',
  'popularity',
  'preview_url',
  'track_number',
  'is_local',
]

const PRUNE_ARTIST_KEYS = ['external_urls', 'followers', 'popularity', 'images']

module.exports = {
  SPOTIFY_SCOPES,
  PROMPT,
  PRUNE_PLAYLIST_KEYS,
  PRUNE_TRACK_KEYS,
  PRUNE_ARTIST_KEYS,
}
