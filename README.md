# SpotifyLens

This is a CLI that helps to aggregate and export Spotify data to local `.json` file.

## Features

- Commandline shortcuts to add current track to the library.
- Commandline shortcuts to next track.
- Get all tracks in the *Liked Songs* library.
- Get a list of unique & ranked artists based on the tracks from *Liked Songs*.

## How to

- Clone the repository
- Create a `.env` file containing this field.     
  As for how to get secret and id, refer to the docs by Spotify.
  
```
ClientID=YOUR ID HERE
ClientSecret=YOUR SECRET HERE
Port=3000
OutputDir=data 
```
- `npm install`
- `node index.js`
- Follow the instrcutions on the terminal.

## Roadmap
- Customize keys to export on objects.
- Genre data.
- Top artists/tracks.

## API

### Worker

- The `Worker` class provides authentication flow and cli-interface.

### SpotifyLens
- The `SpotifyLens` class provides core functions. This class depends on `lodash`, `spotify-web-api-node`, and `mikdirp`. To construct a `SpotifyLens` instance, pass a **authenticated** `SpotifyWebApiNode` instance.
  ```javascript
  const lens = new SpotifyLens(spotifyApi)
  ```
#### Available methods
- `getFavArtists` exports a ordered & unique artists list whose works are found in the *Saved Songs* library.
- `addCurrent` add the currently being played music to the *Saved Songs` library.
- `getAllTracks` exports all tracks found in the *Saved Songs* library.
- `nextTrack` let the playback skip the current track to the next one. 
