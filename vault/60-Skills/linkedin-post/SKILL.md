# LinkedIn Post

Post content to your LinkedIn personal profile.

## Commands

### `/linkedin <text>`
Post a text update to LinkedIn.

**Example:** `/linkedin Excited to share our latest project update!`

### `/linkedin url:<url> <text>`
Share an article or URL with commentary.

**Example:** `/linkedin url:https://blog.example.com/ai-trends Great insights on AI trends in 2026`

### `/linkedin image:<path> <text>`
Share an image with a text caption.

**Example:** `/linkedin image:/path/to/photo.jpg Amazing view from the conference today`

### Visibility
Add `visibility:connections` at the start to limit the post to your connections only (default is public).

**Example:** `/linkedin visibility:connections Quick update for my network`

## Setup
Run `openclaw linkedin-auth` to connect your LinkedIn account (one-time).
Run `openclaw linkedin-status` to check your connection status.

## Limits
LinkedIn allows 150 posts per member per day.
Access tokens expire after 60 days — re-run `openclaw linkedin-auth` to refresh.
