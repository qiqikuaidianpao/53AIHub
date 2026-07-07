# CR Production Release 2026-07-07

## Summary

This release records the China Resources private 53AIHub production fork state that is running on `10.54.158.102:3000`.

Production image:

```text
53aihub-dify-shell:prod-20260707-stream-smooth-a4782c6
```

Production code commit:

```text
a4782c6 fix(web): 避免流式结束时 Markdown 直接跳全量
```

Suggested release tag:

```text
cr-prod-20260707-stream-smooth
```

## Scope

The release keeps the upstream 53AIHub v0.4.0 baseline and consolidates the CR/Dify shell fixes needed for the current private deployment.

Included fixes:

- Preserved Dify streaming newline behavior and file-type handling patches.
- Added CR agent static icons and fixed frontend image fallback issues.
- Fixed private console login flow.
- Fixed Linux frontend build case-sensitivity issues.
- Fixed shared/frontend build gates for server-side builds.
- Aligned Docker Go builder image with `api/go.mod`.
- Fixed Docker build entry to build the full Go package instead of only `main.go`.
- Baked `tiktoken` cache into the Docker image and set `TIKTOKEN_CACHE_DIR`.
- Avoided Redis-disabled image worker log spam when Redis is not enabled.
- Smoothed actual chat answer rendering in the shared chat route.
- Preserved streamed display progress across transient message id/remount changes.
- Avoided Markdown renderer replacing the visible answer with full final content when streaming ends.

## Production Validation

Server health check after deployment:

```text
/health -> 200
version: v0.4.0
build_time: 20260707043807
container: 53aihub
image: 53aihub-dify-shell:prod-20260707-stream-smooth-a4782c6
status: healthy
```

HTTP checks:

```text
/        -> 200
/agent   -> 200
/console -> 200
```

Frontend assets confirmed on production:

```text
assets/index-Dvax6d5m.js        -> 200
assets/ChatContainer-CTOyjXSM.js -> 200
```

Browser validation on the real agent chat page:

```text
URL: http://10.54.158.102:3000/index/agent?agent_id=UkLWZg
XHR /v1/chat/completions response lengths:
176 -> 247 -> 399 -> 625 -> 785 -> 1362

Visible DOM answer lengths:
0 -> 2 -> 8 -> 16 -> 20 -> 26 -> 30 -> 36 -> 46 -> 54 -> 72 -> 84 -> 90 -> 103 -> 109 -> 113 -> 119 -> 125 -> 128 -> 135 -> 144 -> 146 -> 152 -> 158 -> 164 -> 176 -> 182 -> 187 -> 193 -> 199 -> 227
```

The browser check confirms that the API is streaming and the visible answer now grows progressively instead of waiting and replacing the whole answer at the end.

Image validation:

```text
/api/images/agent/icon_tishi.png
/api/images/agent/icon_budongchan.png
```

Agent icons load from real `/api/images/agent/*` resources instead of falling back to `/images/default_agent.png`.

Recent production logs were checked for:

```text
panic
fatal
Redis is not enabled
error
```

No relevant new errors were found in the checked log tail.

## Rollback

The deployment script saved the previous production compose state before switching from `7b1844a` to `a4782c6`.

Rollback backup:

```text
/opt/53aihub-v0.4.0/release-backups/20260707-123805-before-stream-smooth-a4782c6
```

Previous production image:

```text
53aihub-dify-shell:prod-20260707-stream-smooth-7b1844a
```

Rollback outline:

```bash
cd /opt/53aihub-v0.4.0/docker
sed -i 's#^HUB_IMAGE=.*#HUB_IMAGE=53aihub-dify-shell:prod-20260707-stream-smooth-7b1844a#' .env
docker compose up -d --no-deps web
```

## Notes

Production data volumes were not modified during validation or deployment.

Do not commit local/generated noise from the Windows worktree unless intentionally handled:

```text
web/apps/front-react/src/auto-imports.d.ts
api/bin/53aihub-linux-amd64-candidate
```

The server candidate build directory used for this release is temporary build infrastructure:

```text
/opt/53aihub-candidate-work/run-20260706-160506
```

The production compose directory remains:

```text
/opt/53aihub-v0.4.0/docker
```
