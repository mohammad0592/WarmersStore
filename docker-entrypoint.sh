#!/bin/sh
# Starts as root only long enough to give the media folder to the app user, then runs the app
# as that non-root user. Hosts such as Railway mount volumes owned by root, which the app user
# couldn't write to otherwise.
set -eu

media_root="${Media__Root:-/data/media}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$media_root"
  # Only touch what isn't already owned by the app user, so restarts stay fast.
  find "$media_root" \! -user "$APP_UID" -exec chown "$APP_UID:$APP_UID" {} +
  exec setpriv --reuid="$APP_UID" --regid="$APP_UID" --clear-groups --inh-caps=-all -- "$@"
fi

# Already non-root (e.g. the platform chose the user): run as is.
exec "$@"
