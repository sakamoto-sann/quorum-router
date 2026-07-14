#!/bin/sh
set -eu

PREFIX=${HOME}/.local
REF=v0.1.17
DRY_RUN=0
REPO_URL=https://github.com/sakamoto-sann/quorum-router.git

usage() {
  cat <<'USAGE'
Install QuorumRouter helper.

Usage:
  sh install.sh [--dry-run] [--prefix <path>] [--ref <git-ref>] [--help]

Defaults:
  --prefix $HOME/.local
  --ref v0.1.17

The installer prints what it will do. It does not elevate privileges, ask for
credentials, write secret material, enable adapter execution, or configure live
runtime services.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --prefix)
      [ "$#" -ge 2 ] || { echo "--prefix requires a path" >&2; exit 2; }
      PREFIX=$2
      shift 2
      ;;
    --ref)
      [ "$#" -ge 2 ] || { echo "--ref requires a git ref" >&2; exit 2; }
      REF=$2
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

SHARE_DIR=${PREFIX}/share/quorum-router
BIN_DIR=${PREFIX}/bin
WRAPPER=${BIN_DIR}/quorum-router
SHORT_WRAPPER=${BIN_DIR}/quorum

echo "QuorumRouter install plan:"
echo "  repo:   ${REPO_URL}"
echo "  ref:    ${REF}"
echo "  clone:  ${SHARE_DIR}"
echo "  binary: ${WRAPPER}"
echo "  alias:  ${SHORT_WRAPPER}"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "dry-run: no filesystem changes made"
  exit 0
fi

command -v git >/dev/null 2>&1 || { echo "missing required tool: git" >&2; exit 1; }
command -v deno >/dev/null 2>&1 || { echo "missing required tool: deno" >&2; exit 1; }

mkdir -p "$BIN_DIR" "$(dirname "$SHARE_DIR")"

if [ -d "$SHARE_DIR/.git" ]; then
  echo "updating existing checkout at ${SHARE_DIR}"
  git -C "$SHARE_DIR" fetch --tags origin
  case "$REF" in
    main|master)
      git -C "$SHARE_DIR" checkout "$REF"
      git -C "$SHARE_DIR" merge --ff-only "origin/$REF"
      ;;
    *)
      git -C "$SHARE_DIR" checkout --detach "$REF"
      ;;
  esac
else
  echo "cloning ${REPO_URL} at ${REF}"
  git clone --depth 1 --branch "$REF" "$REPO_URL" "$SHARE_DIR"
fi

cat > "$WRAPPER" <<EOF
#!/bin/sh
set -eu
REPO_DIR='${SHARE_DIR}'
TRACK_REF='${REF}'
cmd=\${1:-doctor}
case "\$cmd" in
  doctor)
    cd "\$REPO_DIR" && exec deno task doctor
    ;;
  smoke)
    cd "\$REPO_DIR" && exec deno task smoke:v0.1
    ;;
  test)
    cd "\$REPO_DIR" && exec deno task test
    ;;
  models)
    shift || true
    cd "\$REPO_DIR" && exec deno task models -- "\$@"
    ;;
  version)
    git -C "\$REPO_DIR" describe --tags --always --dirty
    ;;
  update)
    shift || true
    check_only=0
    if [ "\${1:-}" = "--check" ]; then check_only=1; shift; fi
    [ "\$#" -eq 0 ] || { echo "usage: quorum-router update [--check]" >&2; exit 2; }
    [ -z "\$(git -C "\$REPO_DIR" status --porcelain)" ] || {
      echo "update refused: QuorumRouter worktree is dirty" >&2
      exit 1
    }
    git -C "\$REPO_DIR" fetch --tags origin
    case "\$TRACK_REF" in
      main|master)
        current=\$(git -C "\$REPO_DIR" rev-parse HEAD)
        available=\$(git -C "\$REPO_DIR" rev-parse "origin/\$TRACK_REF")
        if [ "\$check_only" -eq 1 ]; then
          [ "\$current" = "\$available" ] && echo "QuorumRouter is up to date: \$current" || echo "QuorumRouter update available: \$current -> \$available"
          exit 0
        fi
        branch=\$(git -C "\$REPO_DIR" branch --show-current)
        [ "\$branch" = "\$TRACK_REF" ] || {
          echo "update refused: expected branch \$TRACK_REF, found \${branch:-detached}" >&2
          exit 1
        }
        git -C "\$REPO_DIR" merge --ff-only "origin/\$TRACK_REF"
        ;;
      *)
        latest=\$(git -C "\$REPO_DIR" tag --list 'v*' --sort=-v:refname | sed -n '1p')
        [ -n "\$latest" ] || { echo "update failed: no release tag found" >&2; exit 1; }
        current=\$(git -C "\$REPO_DIR" describe --tags --exact-match 2>/dev/null || git -C "\$REPO_DIR" rev-parse --short HEAD)
        if [ "\$check_only" -eq 1 ]; then
          [ "\$current" = "\$latest" ] && echo "QuorumRouter is up to date: \$current" || echo "QuorumRouter update available: \$current -> \$latest"
          exit 0
        fi
        git -C "\$REPO_DIR" checkout --detach "\$latest"
        ;;
    esac
    echo "QuorumRouter updated to \$(git -C "\$REPO_DIR" describe --tags --always)"
    ;;
  --help|-h|help)
    echo "quorum-router helper commands: doctor, models, smoke, test, version, update [--check]"
    ;;
  *)
    echo "unknown command: \$cmd" >&2
    echo "quorum-router helper commands: doctor, models, smoke, test, version, update [--check]" >&2
    exit 2
    ;;
esac
EOF
chmod 755 "$WRAPPER"
ln -sf "$WRAPPER" "$SHORT_WRAPPER"

echo "installed ${WRAPPER}"
echo "installed ${SHORT_WRAPPER} -> ${WRAPPER}"
echo "try: ${WRAPPER} doctor"
echo "update later: ${SHORT_WRAPPER} update"
