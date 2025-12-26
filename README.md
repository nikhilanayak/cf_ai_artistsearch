# Artist Search

Find similar artists across genres and generate songs that blend their styles. Uses vector embeddings to match artists and Cloudflare Workers AI to create original lyrics.

## Live App
https://artistsearch.nikhil-a-nayak.workers.dev/

**NOTE to Cloudflare Hiring Managers, etc.:** If you want to use the app locally, you will need to enter a password. This password is the email used to apply for the Cloudflare position. This app is run on personal billing; please enjoy with this in mind!


## Features
- Find similar artists in different genres
  - ex: Who is the Taylor Swift of Rap?

- Generate songs in the style of other artists
  - ex: What would it sound like if Tyler The Creator wrote a Tyler Childers-style country song?

## Technical Components
- Embeddings use Cloudflare Vectorize (@cf/baai/bge-large-en-v1.5)
- Text generation uses Cloudflare Workers AI(
@cf/meta/llama-3.1-70b-instruct)
- 