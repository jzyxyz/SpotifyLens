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
    '  Export an ordered & ranked artists list.',
    '  List all playlists with its id',
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

module.exports = {
  SPOTIFY_SCOPES,
  PROMPT,
}
