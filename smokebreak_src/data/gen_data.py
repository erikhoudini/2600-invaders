#!/usr/bin/env python3
"""
Converts question.xml into questions.dat, a flat binary format the DS
build parses directly into RAM-resident pointer tables at startup --
no XML parser needed on-device.

Format (all integers little-endian):
  u16 numQuestionnaires
  for each questionnaire:
    u8  titleLen ; char title[titleLen]        (no null terminator)
    u16 descLen  ; char desc[descLen]
    u16 numQuestions
    for each question:
      u16 qLen ; char q[qLen]
"""
import struct
import sys
import xml.etree.ElementTree as ET

# The DS build's bitmap font covers printable ASCII 32-126 only.
# Transliterate the handful of non-ASCII characters actually present
# in question.xml (checked directly, not assumed) to ASCII equivalents
# so nothing silently renders blank.
SANITIZE = {
    "\u2019": "'",   # ’
    "\u2018": "'",   # ‘
    "\u201c": '"',   # “
    "\u201d": '"',   # ”
    "\u00a3": "GBP ",  # £
}

def sanitize(s):
    for bad, good in SANITIZE.items():
        s = s.replace(bad, good)
    return s.encode("ascii", "replace").decode("ascii")

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "../../question.xml"
    dst = sys.argv[2] if len(sys.argv) > 2 else "../nitrofiles/questions.dat"

    tree = ET.parse(src)
    root = tree.getroot()
    questionnaires = root.findall("questionnaire")

    out = bytearray()
    out += struct.pack("<H", len(questionnaires))

    total_q = 0
    for q in questionnaires:
        title = sanitize((q.findtext("title") or "").strip())
        desc = sanitize((q.findtext("description") or "").strip())
        questions = [
            sanitize((qq.text or "").strip())
            for qq in q.findall("question")
            if (qq.text or "").strip()
        ]
        total_q += len(questions)

        title_b = title.encode("utf-8")[:255]
        desc_b = desc.encode("utf-8")[:65535]

        out += struct.pack("<B", len(title_b)) + title_b
        out += struct.pack("<H", len(desc_b)) + desc_b
        out += struct.pack("<H", len(questions))
        for qs in questions:
            qb = qs.encode("utf-8")[:65535]
            out += struct.pack("<H", len(qb)) + qb

    with open(dst, "wb") as f:
        f.write(out)

    print(f"{len(questionnaires)} questionnaires, {total_q} questions, "
          f"{len(out)} bytes -> {dst}")

if __name__ == "__main__":
    main()
