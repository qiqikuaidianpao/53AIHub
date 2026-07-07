# Dify Shell 53AIHub Release Runbook

This runbook is for the Dify shell fork maintained at `qiqikuaidianpao/53AIHub`.
It documents the reversible production switch from the original 53AIHub image to
the Dify shell image, plus the current accepted production tag.

Last candidate smoke verification: 2026-07-06.
Production switch and stability verification: 2026-07-07.

## Verified State

Fork head:

```text
104413b fix(api): 内置 tiktoken 缓存并跳过无 Redis worker
```

Upstream relation at verification time:

```text
upstream/main...HEAD = 0 8
```

Current production web container:

```text
container: 53aihub
compose project: 53ai-hub
compose service: web
compose dir: /opt/53aihub-v0.4.0/docker
current image: 53aihub-with-tiktoken:final
published port: 0.0.0.0:3000->3000/tcp
restart policy: unless-stopped
```

Candidate image already built on the server:

```text
53aihub-dify-shell:candidate-20260706-104413b
image id: sha256:9e6a382d679055f113f8a7f55071ac359de96f0122478eece9049a2077dd5aea
size: 207MB
```

Smoke result for the candidate image:

```text
/health -> 200
/ -> 200
/console -> 200
/assets/index-CH5Zxm3e.js -> 200 application/javascript
/console/static/js/index-bd772c65.js -> 200 application/javascript
tiktoken cache exists in /app/tiktoken-cache
REDIS_CONN empty smoke: no repeated "dequeue error: Redis is not enabled"
```

Accepted production image after the 2026-07-07 switch:

```text
53aihub-dify-shell:prod-20260707
image id: sha256:9e6a382d679055f113f8a7f55071ac359de96f0122478eece9049a2077dd5aea
source tag: 53aihub-dify-shell:candidate-20260706-104413b
```

Production stability check after the switch:

```text
duration: 10 minutes
samples: 60
failed samples: 0
container health: healthy
container restart_count: 0
panic/fatal log count: 0
Redis dequeue error count: 0
token encoder error count: 0
```

Production persistence after acceptance:

```text
/opt/53aihub-v0.4.0/docker/.env
HUB_IMAGE=53aihub-dify-shell:prod-20260707
```

## Hard Boundaries

Do not run these commands during release or rollback:

```bash
docker compose down -v
docker volume prune
docker system prune --volumes
rm -rf /opt/53aihub-v0.4.0/docker/data
rm -rf /opt/53aihub-v0.4.0/docker/logs
rm -rf /opt/53aihub-v0.4.0/docker/data/uploads
```

Do not replace or restart production until the operator explicitly approves the
release window.

The production data directories that must be preserved are under:

```text
/opt/53aihub-v0.4.0/docker/data
/opt/53aihub-v0.4.0/docker/logs
```

## Variables

Run the release commands on the server.

```bash
export PROD_DIR=/opt/53aihub-v0.4.0/docker
export BACKUP_ROOT=/opt/53aihub-v0.4.0/release-backups
export CURRENT_IMAGE=53aihub-with-tiktoken:final
export CANDIDATE_IMAGE=53aihub-dify-shell:candidate-20260706-104413b
export PROD_IMAGE=53aihub-dify-shell:prod-20260707
export HEALTH_URL=http://127.0.0.1:3000/health
```

If the server needs GitHub or public download access, open the local proxy reverse
tunnel from the workstation first. Use site-specific SSH host and key values; do
not commit them to the repository.

```powershell
$argsList = @(
  '-i','<ssh-key-path>',
  '-N','-o','ExitOnForwardFailure=yes',
  '-R','127.0.0.1:7897:127.0.0.1:7897',
  '<user>@<server-host>'
)
$p = Start-Process -FilePath ssh -ArgumentList $argsList -WindowStyle Hidden -PassThru
```

Stop it after the server-side network operation:

```powershell
Stop-Process -Id $p.Id -Force
```

## Preflight

Confirm the production service is healthy before touching anything:

```bash
cd "$PROD_DIR"
docker compose ps
docker ps --filter name=53aihub
curl -fsS "$HEALTH_URL"
```

Confirm the candidate image exists and contains the baked tiktoken cache:

```bash
docker image inspect "$CANDIDATE_IMAGE" >/dev/null
docker run --rm --entrypoint sh "$CANDIDATE_IMAGE" -lc '
  test -s /app/tiktoken-cache/9b5ad71b2ce5302211f9c61530b329a4922fc6a4
  test -s /app/tiktoken-cache/fb374d419588a4632f3f557e76b4b70aebbca790
  echo "tiktoken-cache-ok"
'
```

Create a root-only backup directory for rollback evidence. This copies `.env`, so
keep the backup on the server and never commit or upload it.

```bash
cd "$PROD_DIR"
backup_dir="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)-before-dify-shell"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"

docker inspect 53aihub > "$backup_dir/53aihub.inspect.json"
docker compose config > "$backup_dir/docker-compose.rendered.yml"
cp -a docker-compose.yml "$backup_dir/docker-compose.yml"
cp -a .env "$backup_dir/.env"
```

Recommended database backup before the switch:

```bash
docker exec 53aihub-mysql sh -lc '
  exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
    --single-transaction --routines --triggers 53ai_hub
' > "$backup_dir/53ai_hub.sql"
```

## Reversible Switch

Use a temporary compose override instead of editing the production `.env` or
`docker-compose.yml`. This recreates only the `web` service with the candidate
image and leaves MySQL, Redis, Qdrant, uploads, logs, and config mounts in place.

```bash
cd "$PROD_DIR"
cat > /tmp/53aihub-web-image.candidate.yml <<YAML
services:
  web:
    image: ${CANDIDATE_IMAGE}
YAML

docker compose \
  -f docker-compose.yml \
  -f /tmp/53aihub-web-image.candidate.yml \
  up -d web
```

Do not run `docker compose down`. Compose will replace the `web` container but
keep the service name `53aihub` and the existing mounted data paths.

## Post-switch Checks

Run the checks immediately after the container is recreated:

```bash
for i in $(seq 1 60); do
  if curl -fsS "$HEALTH_URL"; then
    echo
    echo "health-ok"
    break
  fi
  sleep 2
  if [ "$i" = 60 ]; then
    echo "health-timeout"
    docker logs --tail 300 53aihub
    exit 1
  fi
done

curl -sS -D - http://127.0.0.1:3000/ -o /tmp/53aihub-front.html | head
curl -sS -D - http://127.0.0.1:3000/console -o /tmp/53aihub-console.html | head
docker logs --tail 300 53aihub | grep -E 'panic|fatal|dequeue error: Redis is not enabled|tiktoken|token encoder' || true
```

Confirm Docker is running the candidate image:

```bash
docker inspect 53aihub --format 'image={{.Config.Image}} id={{.Image}}'
docker ps --filter name=53aihub --format '{{.Names}} {{.Image}} {{.Status}} {{.Ports}}'
```

If external traffic is routed through a gateway or CDN, also check the public URL
from outside the server after local checks pass.

## Rollback

Rollback uses the same compose override pattern and restores the previous image.

```bash
cd "$PROD_DIR"
cat > /tmp/53aihub-web-image.rollback.yml <<YAML
services:
  web:
    image: ${CURRENT_IMAGE}
YAML

docker compose \
  -f docker-compose.yml \
  -f /tmp/53aihub-web-image.rollback.yml \
  up -d web
```

Then verify:

```bash
curl -fsS "$HEALTH_URL"
docker inspect 53aihub --format 'image={{.Config.Image}} id={{.Image}}'
docker logs --tail 300 53aihub
```

This code-level candidate does not intentionally add database migrations, but
database backups should still be kept until the release has survived normal
traffic.

## Making the Switch Persistent

The temporary override is best for a controlled first switch. After the candidate
has been observed under real traffic and accepted, make the desired image choice
persistent in the production deployment process.

Preferred options:

```text
1. Put the accepted image tag in the production .env as HUB_IMAGE.
2. Or keep a named compose override file in the production directory and always
   include it in future docker compose commands.
3. Or retag the accepted image through the team's normal registry/release flow.
```

Do not persist the change until rollback confidence is clear and the operator has
approved the release state.
