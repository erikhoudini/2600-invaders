# War story: nine iterations to a working font patch

This is the detailed version of "How to work under these constraints" in
SKILL.md. The task: shrink the reading-mode body font in a DS book-reader
game so books take fewer pages. The bug hunt took far longer than it
should have, and nearly every wasted round shares one root cause worth
naming up front: **changing code and re-shipping a build is cheap; each
round trip through the user's emulator is not.** Every iteration below
that turned out to fix nothing was a real cost.

## Round 1-2: it "worked" but did nothing visible

First patch shrunk the font file and repacked cleanly, no errors. User
reported no visible size change. This should have been the first red
flag that something more was wrong than "make the numbers smaller" --
instead, the response was to build a second, more extreme test (all
glyphs replaced with solid black blocks) to check whether the file was
being read *at all*.

That diagnostic was the right instinct -- when you don't know if your
change is having *any* effect, make an unmissable version and check that
first, before refining a subtle one. It just also revealed the wrong
file was being targeted: the edited font turned out to control page
numbers, not the reading body text. Lesson: **don't assume which of
several similarly-named resources (font_body_12 vs _14 vs _18) maps to
which user-facing setting -- confirm it by making an unmistakable change
and observing which UI element it affects.**

## Round 3: found the crash, learned the wrong lesson from it

Once the right file was found (`font_body_14`), a same-size typeface
swap worked cleanly, confirming the pipeline was sound. The next patch
(a real size reduction) came back BROKEN -- specific narrow letters
(i, t, f, l) rendered as tiny fragments instead of full letterforms.

The actual bug at this point was a real, concrete one: glyphs with
natural negative left-bearing were getting silently clipped by drawing
at a fixed x=0 origin with no margin. That got correctly found and
fixed by measuring bounding boxes in a padded scratch canvas instead of
the tight final canvas. Good, real fix.

## Round 4: fixed a different bug, the actual bug didn't move

The SAME broken letters, in the SAME way, persisted after the round-3
fix. The response was to hypothesize a *different* cause (antialiasing --
partial-coverage pixels not surviving however the renderer reads the
bitmap) and hard-threshold every pixel to pure black/white.

This "fixed" nothing, because it was addressing a bug that didn't exist.
**The tell was right there and got missed for a round: if a change to
the rendering pipeline produces a visually identical broken result, that
is strong evidence you changed a variable that isn't the cause** -- not
weak evidence that needs a bigger version of the same kind of change to
confirm. The user eventually had to say this explicitly ("that's not
doing anything... you're wasting tokens... think harder") before the
approach actually changed.

## Round 5: found the real bug by finally reading real data

Only after being told to stop guessing did the actual productive step
happen: dump the CWDH width table from the ORIGINAL, unmodified file and
look at actual numbers instead of reasoning about the spec abstractly.
That immediately showed every character shares an identical `total`
advance value regardless of visible width -- true monospacing at the
layout level. The code had been computing a real proportional advance
per glyph, so narrow letters reserved too little horizontal space and
the next character drew over them. This was the actual bug behind
rounds 3-4's symptom, and it was found in minutes once the right thing
(real original data, not another rendering tweak) was looked at.

**The general lesson, stated as plainly as possible: when two or three
targeted fixes in a row produce no visible change, stop changing the
code and go read the actual bytes of a real, working example instead.**
Every hour spent iterating on plausible-sounding hypotheses without
touching ground truth was strictly worse than the twenty minutes it took
to dump and eyeball real width-table values once that was finally tried.

## Round 6: a second real bug, found the same disciplined way

Text loaded and didn't overlap anymore, but specific characters (still
narrow ones, by coincidence) looked broken in a new way. Rather than
guessing again, the next step was comparing the SAME letters decoded
under every plausible axis/orientation interpretation side by side, and
noticing that CWDH's `leading`/`width` fields, assumed to be horizontal
side-bearing and ink-width per a generic spec, actually tracked
*vertical* position (ascenders vs. x-height vs. descenders clustered by
value, and leading+width summed to a constant matching the baseline).
The bitmap was also being double-offset: ink was positioned within the
bitmap AND a leading value was being added on top, applying the shift
twice. Found by measuring, not by another plausible-sounding theory.

## Round 7-9: legitimate design iteration, not bug hunting

Once rendering was actually correct, remaining feedback (too blocky/no
antialiasing, line spacing too tight, blank tofu boxes for punctuation)
were real but different in kind -- not "the code is wrong" but "the
chosen settings/behavior aren't what the user wants yet," plus one more
genuine bug (CP1252 byte values decoded with Python's `chr()` instead of
proper CP1252 decoding, so punctuation like em-dashes silently became
invisible control characters instead of visible glyphs). That last one
was, again, found by writing a two-line reproduction
(`chr(0x97)` vs `bytes([0x97]).decode('cp1252')`) and looking at actual
output, rather than reasoning about it.

## Distilled principles

1. **A decoder built with the same assumptions as your encoder can only
   ever confirm itself.** It is not independent evidence. The only real
   validation available offline is decoding data you did NOT write --
   the original file -- and confirming you can read it correctly.

2. **When a fix doesn't change the observed symptom, that's information
   about your hypothesis, not the fix's execution.** Don't reach for a
   stronger version of the same kind of change; reach for a different
   *category* of explanation, ideally by measuring something you haven't
   measured yet.

3. **A format "spec" -- generic, or for a similar game -- is a
   hypothesis to check against real bytes, not an authority.** Field
   names and their conventional meanings drift between SDK versions and
   between developers' actual usage. When your assumption and the real
   data's pattern disagree, the data wins.

4. **The highest-leverage single action when stuck is usually: dump real
   values from several known-good examples and look for the pattern by
   eye**, before writing any more code. This found both of the two real
   structural bugs in this case study, each within minutes of finally
   being tried, after much longer spent on plausible-sounding alternative
   theories.

5. **Distinguish "I found and fixed a specific, demonstrable bug" from "I
   have a theory and it's untested" in what you tell the user, every
   round.** Conflating the two is what makes repeated failed attempts
   feel like not listening rather than genuine progress -- and the user
   is the only one who can run the actual test, so wasting their round
   trips on unstated-low-confidence guesses is the single most expensive
   mistake available in this kind of work.
