# SpotifyLens

This is a **enhanced** wrapper for Spotify-api. It provides a simple api to the data otherwise have to be computed.
e.g.

- a list of unique & ordered artists from a playlist.
- paged data concatation.
- ...

Along with the package also comes a simple-to-use cli with which these data can be exported to local `.json` file. In addition, some handy playback controls are also integrated.
such as:

- add current track to the library.
- play the next track.
- ...

## Features

- Cli control over spotify.
- Get all tracks in **ANY** playlists.
- Get a list of unique & ranked artists based on the tracks from **ANY** playlist.

## How to

- Clone the repository
- Create a `.env` file containing these fields.  
  As for how to get secret and id, refer to the docs by Spotify.

```
ClientID=YOUR ID HERE
ClientSecret=YOUR SECRET HERE
Port=3000
OutputDir=data
All_Saved_Tracks=OUTPUT DIR OF TRACKS
Artists=OUTPUT DIR OF ARTISTS
```

- `npm install` && `node run.js`.
- _Or_ `npm i spotify-lens`.
- Follow the instrcutions on the terminal.

## API

### Worker

The `Worker` class provides authentication flow and cli.

```javascript
const { Worker } = require('spotify-lens')

const w = new Worker()
w.start()
```

### SpotifyLens

The `SpotifyLens` class provides core functions, and is well-suited to be embeded into exsiting web services. It depends on `lodash`, `spotify-web-api-node`. To construct a `SpotifyLens` instance, pass a **authenticated** `SpotifyWebApiNode` instance.

```javascript
const { SpotifyLens } = require('spotify-lens')
// authenticate with worker/spotify-web-api-node
const lens = new SpotifyLens(spotifyApi)
```

#### Available methods

- `getAllTracks(playlistId)` returns all tracks found in the playlist with `playlistId`.
- `getFavArtists(playlistId)` returns a ordered & unique artists list whose works are found in the playlist with `playlistId`.
  If `playlistId` is `undefined`, it will target at the _Saved Songs_ library.
- `addCurrent` adds the currently being played track to the _Saved Songs_ library.
- `nextTrack` lets the playback skip the current track to the next one.
- `showPlaylists` returns all playlists and the corresponding id.
- `getTopArtists({ time_range, limit, offset })` returns the spotify personalization information about top artistis. Same logic applies to `getTopTracks({ time_range, limit, offset })`
  **NB**
  This is **different** from the default beheavior as specified by Spotfiy documentation. According to documentation from Spotify, the `time_range` is set to `mid_term` as default value. However, this function return data in **all** three time ranges. The returned value look like this:

```json
{
  "long_term": [
    {
      //...
      "genres": [],
      "id": "4KXp3xtaz1wWXnu5u34eVX",
      "images": [],
      "popularity": 62,
      "type": "artist"
    }
    // ...
  ],
  "mid_term": [
    {
      //...
    }
  ],
  "short_term": [
    {
      //...
    }
  ]
}
```

- `//TODO`

## Configure

In the `config.js`, you can configure some beheavior of the api.

- `PRUNE_PLAYLIST_KEYS` contains the keys to be deleted when a `playlist` object is fetched from spotify api.
- The same logic applies to `PRUNE_TRACK_KEYS`.
- `SPOTIFY_SCOPES` contains the scopes required for Spotify API.

## Roadmap

- [x] Customize keys to export on objects.
- [ ] Genre data.
- [ ] Top artists/tracks.
