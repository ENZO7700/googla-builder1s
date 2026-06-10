# wpBOX Local WordPress

Clean local WordPress target for testing LarsenEvans-wpBOX.

## URL

- WordPress: `http://localhost:18090`
- REST root: `http://localhost:18090/wp-json`
- Admin: `http://localhost:18090/wp-admin`
- Admin username: `admin`
- Admin password: `admin123`

## Start

```bash
scripts/wpbox-workspace.sh start
```

This helper keeps the local wpBOX WordPress pinned to this repository and port `18090`.

## First install

```bash
docker compose -f local-wordpress/docker-compose.yml --profile tools run --rm wpcli sh -lc 'until wp core is-installed --allow-root || wp db check --allow-root; do sleep 2; done; wp core install --allow-root --url=http://localhost:18090 --title="wpBOX Local WordPress" --admin_user=admin --admin_password=admin123 --admin_email=admin@example.test --skip-email || wp core update-db --allow-root'
```

The credentials above are local-only development placeholders. Do not reuse them anywhere else.

## Stop

```bash
scripts/wpbox-workspace.sh stop
```

## Status / check

```bash
scripts/wpbox-workspace.sh status
scripts/wpbox-workspace.sh check
```

## Run iOS Simulator

```bash
scripts/wpbox-workspace.sh ios-sim
```

This starts the local WordPress server on the Mac, then builds and launches the iOS app in Simulator.
The Simulator app uses `http://localhost:18090`; do not run WordPress inside the Simulator.

Optional:

```bash
WPBOX_SIMULATOR_NAME="iPhone 17" scripts/wpbox-workspace.sh ios-sim
WPBOX_SIMULATOR_ID="<simulator-udid>" scripts/wpbox-workspace.sh ios-sim
```

## Reset

This deletes the local WordPress database and files:

```bash
scripts/wpbox-workspace.sh reset --confirm-delete-local-wpbox-volumes
```
