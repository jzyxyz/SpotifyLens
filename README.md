# SpotifyLens

This is a CLI that helps to aggregate and export Spotify data to local `.json` file.

## Features

- Get all tracks in the *Liked Songs* library
- Get a list of unique & ranked artists based on the tracks from *Liked Songs*

## How to

- Clone the repository
- Create a `.env` file containing this field
```
ClientID=YOUR ID HERE
ClientSecret=YOUR SECRET HERE
LogInCallback=http://localhost:3000/callback/
OutputDir=data 
```
    As for how to get secret and id, refer to the docs by Spotify.
- `npm install`
- `npm start`
- Follow the instrcutions on the terminal

## Roadmap
- Customize keys to export on objects
- Genre data
- Top artists/tracks
