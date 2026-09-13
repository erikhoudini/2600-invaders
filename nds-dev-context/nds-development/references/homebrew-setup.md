# devkitARM/libnds toolchain setup

For Workflow C (from-scratch homebrew). This is the bootstrap procedure
for a Linux environment that doesn't already have devkitPro installed
(e.g. a fresh sandbox). If `arm-none-eabi-gcc` and `$DEVKITPRO` already
resolve, skip this entirely.

## The two gotchas

Both of devkitPro's asset domains (`apt.devkitpro.org`,
`pkg.devkitpro.org`) sit behind Cloudflare, which blocks non-browser
User-Agents with a 403. This breaks manual `curl`/`wget` (default UA
gets blocked) but does **not** break `apt-get` (its UA is accepted), so
`apt-get update`/`install` against the devkitPro repo works fine even
though a plain `curl` to the same host returns 403. If you need to fetch
anything from these hosts by hand, pass a browser UA:
`curl -A "Mozilla/5.0 (X11; Linux x86_64)" ...`

Second: after installing `devkitpro-pacman` via apt, its *own* pacman
tool (`dkp-pacman`) can fail with `server certificate verification
failed` against `pkg.devkitpro.org` even though `curl` to the same host
succeeds. The tool ships its own `cacert.pem` that can be stale relative
to the system's. Fix by pointing it at the system CA bundle:

```sh
cp /etc/ssl/certs/ca-certificates.crt /opt/devkitpro/pacman/etc/ssl/certs/cacert.pem
```

## Full bootstrap

```sh
# 1. Add the devkitPro apt repo and install its pacman wrapper.
#    (apt's UA is accepted by Cloudflare; a raw curl to this URL is not.)
curl -sA "Mozilla/5.0 (X11; Linux x86_64)" -o install-devkitpro-pacman \
  https://apt.devkitpro.org/install-devkitpro-pacman
chmod +x install-devkitpro-pacman
bash install-devkitpro-pacman   # as root; this step alone can hang/timeout
                                 # near the end -- if it does, the repo is
                                 # already registered, just continue below

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y devkitpro-pacman

# 2. Fix the stale bundled CA cert (see gotcha above), then finish
#    devkitpro-pacman's deferred postinst, which is what actually syncs
#    the package databases.
cp /etc/ssl/certs/ca-certificates.crt /opt/devkitpro/pacman/etc/ssl/certs/cacert.pem
dpkg --configure devkitpro-pacman

# 3. Install the NDS dev group + host-side tools (ndstool, etc).
#    ~100MB; a transient 403 mid-download on one package is common --
#    just re-run the same command, it resumes cleanly.
export DEVKITPRO=/opt/devkitpro
export PATH=/opt/devkitpro/pacman/bin:$PATH
dkp-pacman -S --noconfirm nds-dev general-tools

# 4. Set up the toolchain env vars for the current shell.
source /etc/profile.d/devkit-env.sh
# DEVKITPRO=/opt/devkitpro, DEVKITARM=/opt/devkitpro/devkitARM now set.
```

## Verifying it worked

```sh
arm-none-eabi-gcc --version
ls $DEVKITPRO/examples/nds        # stock examples, read before writing from memory
ls $DEVKITPRO/libnds/include/nds  # current header set -- ground truth over cached knowledge
```

## Build pattern

Standard devkitARM project layout: a `Makefile` that includes
`$(DEVKITARM)/ds_rules`, C sources under `source/`, linking `-lnds9`.
Copy the Makefile from the closest matching example under
`$DEVKITPRO/examples/nds/` rather than writing one from scratch --
the pattern rules for `.elf` -> `.nds` (via `ndstool`, with the
default-arm7 binary and a default icon auto-supplied) are already
correct there.

```sh
export PATH=$DEVKITARM/bin:$DEVKITPRO/tools/bin:$PATH
make
```

Output is `<TARGET>.nds`, ready to hand to the user or test in an
emulator.
