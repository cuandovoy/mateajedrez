# Error & Edge Case Handling

| Case | Behavior |
|---|---|
| Product out of stock | Report `in_stock: false` with the stock label found; do not skip the product or retry the page. |
| Filter/search returns zero results | Report the empty result plainly; suggest relaxing a filter if asked for next steps. Never fabricate matching products. |
| CAPTCHA or bot-detection challenge | Stop immediately. Never attempt to solve or bypass it. Report to the user and ask how to proceed. |
| Timeout / slow dynamic content | Wait and retry loading at most once or twice (short pause, or a scroll to trigger lazy-loaded content). If it still hasn't loaded, report the failure instead of looping indefinitely. |
| Page structure doesn't match any known heuristic | Fall back to the most literal reading of visible text; report lower confidence on the affected fields rather than guessing. Log the break in `changelog.md`. |

Follow the global browser-automation guidance on avoiding rabbit holes: after 2-3 failed attempts at the same action, stop and ask the user rather than retrying indefinitely.
