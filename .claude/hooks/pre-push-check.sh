#!/usr/bin/env bash
#
# PreToolUse hook for the Bash tool: guards `git push`.
#
# Claude Code runs this before every Bash command and passes the tool call as
# JSON on stdin. For anything that is not a `git push` it exits 0 at once. For
# a push it runs the merchant console's tests and then its build, and blocks
# the push (exit 2) if either one fails.
#
# A failure prints which check failed and where its full output was saved.
# Output goes to $TMPDIR/pre-push-check/ (or /tmp/pre-push-check/).
#
# Note: `npm run build` writes to the app's .next folder, which a running
# `next dev` in the same folder also uses. Restart the dev server after a push
# if the page looks broken.

set -u

# Hooks run in a non-login shell, so node and npm may not be on the PATH.
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin"

input="$(cat)"

# Every Bash command comes through here, so failing to inspect one must never
# block it. Without python3 there is nothing to check; let it through.
command -v python3 >/dev/null 2>&1 || exit 0

# Prints the directory a `git push` in this command would run in, or nothing
# if the command does not push.
push_dir="$(
  printf '%s' "$input" | python3 -c '
import json, os, re, shlex, sys

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

command = (data.get("tool_input") or {}).get("command") or ""
cwd = data.get("cwd") or os.getcwd()


def drop_heredoc_bodies(text):
    """Text typed into a heredoc is data, not commands."""
    kept, end = [], None
    for line in text.split("\n"):
        if end is not None:
            if line.strip() == end:
                end = None
            continue
        kept.append(line)
        match = re.search(r"<<-?\s*([\x27\"]?)(\w+)\1", line)
        if match:
            end = match.group(2)
    return "\n".join(kept)


def split_commands(text):
    """Split on ; && || | & and newlines, but not inside quotes."""
    parts, buf = [], []
    quote = None
    escaped = False
    for ch in text:
        if escaped:
            buf.append(ch)
            escaped = False
        elif ch == "\\" and quote != "\x27":
            buf.append(ch)
            escaped = True
        elif quote:
            buf.append(ch)
            if ch == quote:
                quote = None
        elif ch in "\x27\"":
            buf.append(ch)
            quote = ch
        elif ch in ";&|\n":
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    parts.append("".join(buf))
    return [p.strip() for p in parts if p.strip()]


def tokens_of(segment):
    try:
        return shlex.split(segment)
    except ValueError:
        return segment.split()


current = cwd
for segment in split_commands(drop_heredoc_bodies(command)):
    tokens = tokens_of(segment)
    # Leading VAR=value assignments.
    while tokens and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", tokens[0]):
        tokens = tokens[1:]
    if not tokens:
        continue

    if tokens[0] == "cd":
        target = tokens[1] if len(tokens) > 1 else "~"
        current = os.path.abspath(os.path.join(current, os.path.expanduser(target)))
        continue

    if tokens[0] != "git":
        continue

    where = current
    rest = tokens[1:]
    while rest and rest[0].startswith("-"):
        option = rest[0]
        if option in ("-c", "-C", "--git-dir", "--work-tree", "--namespace") and len(rest) > 1:
            if option == "-C":
                where = os.path.abspath(os.path.join(where, os.path.expanduser(rest[1])))
            rest = rest[2:]
        else:
            rest = rest[1:]
    if rest and rest[0] == "push":
        print(where)
        break
'
)"

[ -n "$push_dir" ] || exit 0

# Only this project: the checkout the push runs in must contain the console.
toplevel="$(git -C "$push_dir" rev-parse --show-toplevel 2>/dev/null)" || exit 0
app="$toplevel/build-battle/merchant-console"
[ -f "$app/package.json" ] || exit 0

log_dir="${TMPDIR:-/tmp}"
log_dir="${log_dir%/}/pre-push-check"
mkdir -p "$log_dir"

block() {
  # $1 = check name, $2 = log file, $3 = command to re-run it
  {
    echo "Push blocked: the $1 failed."
    echo "  Full output:  cat $2"
    echo "  Re-run it:    cd $app && $3"
    echo
    echo "Last lines of the output:"
    tail -n 15 "$2" 2>/dev/null | sed 's/^/  /'
  } >&2
  exit 2
}

if [ ! -d "$app/node_modules" ]; then
  echo "Push blocked: dependencies are not installed in $app." >&2
  echo "  Run:  cd $app && npm install" >&2
  exit 2
fi

cd "$app" || exit 0

tests_log="$log_dir/tests.log"
npm test >"$tests_log" 2>&1 || block "tests" "$tests_log" "npm test"

build_log="$log_dir/build.log"
npm run build >"$build_log" 2>&1 || block "build" "$build_log" "npm run build"

exit 0
