# The Unleashed — portfolio

Single-page portfolio for The Unleashed: character portraits, fan art and sketchbook work. Plain HTML, CSS and JavaScript, no build step. Open `index.html` or serve the folder.

## Structure

```
index.html        page content, including the full artwork index (#sheet)
css/style.css     design tokens at the top (colours, type sizes, margins)
js/script.js      entrances, sketchbook frame, filter, viewer
art/Digital/      digital pieces, used directly by the page
art/Traditional/  sketchbook photos, used directly by the page
art/painting/     paintings, used directly by the page
art/profile.jpg   About photo
```

## Adding a piece

1. Put the image in `art/Digital/` or `art/Traditional/`.
2. Copy one `<li>` in `#sheet` in `index.html` and change its `data-*` fields:
   `data-cat` is `fan`, `portrait`, `original`, `sketch` or `painting`; `data-yt` is the YouTube video id of the speedpaint (optional); `data-ig` is the Instagram post URL (optional); `data-note` is one line about the piece, shown in the viewer (optional).
3. Update the counts on the filter buttons.

## Oddly Us: weekly pages (no code, no commit)

Series pages are uploaded through `/studio.html` and stored in Vercel Blob, not in this repo.

1. Open `https://<your-site>/studio.html` and enter the studio password.
2. Pick the story (e.g. Story 01), choose this week's images and press Upload. They're resized in the browser and added after the existing pages, sorted by file name (`01.jpg`, `02.jpg`…).
3. The series page and `story.html?s=story-01` show them within about 5 minutes.

When a story ends, pick Story 02 and carry on. A story's card on `series.html` stays "Coming soon" until it has pages. "Scroll" stories are for one long vertical strip; their panels are stacked without gaps.

How it fits together:

```
studio.html, js/studio.js   upload page (not linked anywhere, noindex)
api/studio.js               checks STUDIO_PASSWORD, saves / deletes pages in Blob
api/series.js               public list of stories and pages, cached 5 minutes
js/series.js, story.html    series cards and the reading page
```

One-time setup in Vercel: Storage → create a Blob store with **public** access and connect it to this project (adds `BLOB_READ_WRITE_TOKEN`), then add an environment variable `STUDIO_PASSWORD` (12+ characters) and redeploy.

## Contact

Every contact button opens an Instagram DM through `https://ig.me/m/_._unleashed_._`. If the handle changes, search `index.html` for `ig.me/m/` and update each link.
