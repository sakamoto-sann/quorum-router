#!/bin/sh
set -eu

PREFIX=${HOME}/.local
REF=v0.1.4
DRY_RUN=0
REPO_URL=https://github.com/sakamoto-sann/fusion-router.git

usage() {
  cat <<'USAGE'
Install QuorumRouter helper.

Usage:
  sh install.sh [--dry-run] [--prefix <path>] [--ref <git-ref>] [--help]

Defaults:
  --prefix $HOME/.local
  --ref v0.1.4

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

echo "QuorumRouter install plan:"
echo "  repo:   ${REPO_URL}"
echo "  ref:    ${REF}"
echo "  clone:  ${SHARE_DIR}"
echo "  binary: ${WRAPPER}"

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
  git -C "$SHARE_DIR" checkout --detach "$REF"
else
  echo "cloning ${REPO_URL} at ${REF}"
  git clone --depth 1 --branch "$REF" "$REPO_URL" "$SHARE_DIR"
fi

cat > "$WRAPPER" <<EOF
#!/bin/sh
set -eu
REPO_DIR='${SHARE_DIR}'
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
  --help|-h|help)
    echo "quorum-router helper commands: doctor, smoke, test"
    ;;
  *)
    echo "unknown command: \$cmd" >&2
    echo "quorum-router helper commands: doctor, smoke, test" >&2
    exit 2
    ;;
esac
EOF
chmod 755 "$WRAPPER"

echo "installed ${WRAPPER}"
echo "try: ${WRAPPER} doctor"
