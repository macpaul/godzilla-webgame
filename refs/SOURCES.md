# 美術参考 — art reference sources

Reference images for drawing the kaiju. **None of these files are loaded by the
game** — all in-game art is drawn procedurally in `js/art.js`. This folder
exists so the silhouettes in `docs/research.md` can be checked against the
suits.

Two tiers, split by licence:

## 1. Committed — public domain (Wikimedia Commons)

All ten are tagged Public Domain on Wikimedia Commons, as stated on each
source file page — check that page before reusing them anywhere. Files are
resized to ≤900 px and re-encoded to keep the repo light; the links point at
the full-size original.

| File in `refs/` | Original on Commons | Credited author |
|---|---|---|
| `anguirus-suit-1955.jpg` | [Godzilla Raids Again (1955) Anguirus suit.jpg](https://commons.wikimedia.org/wiki/File:Godzilla_Raids_Again_(1955)_Anguirus_suit.jpg) | Unknown |
| `anguirus-head-1955.jpg` | [Godzilla Raids Again (1955) Anguirus head.jpg](https://commons.wikimedia.org/wiki/File:Godzilla_Raids_Again_(1955)_Anguirus_head.jpg) | Unknown |
| `king-ghidorah-rampage-1964.jpg` | [GT3HM - King Ghidorah on the rampage.jpg](https://commons.wikimedia.org/wiki/File:GT3HM_-_King_Ghidorah_on_the_rampage.jpg) | Toho Co., Ltd. |
| `king-ghidorah-suit-1964.jpg` | [King Ghidorah suit early paint job.jpg](https://commons.wikimedia.org/wiki/File:King_Ghidorah_suit_early_paint_job.jpg) | Toho |
| `rodan-flying-model-1956.jpg` | [Rodan half size flying model.png](https://commons.wikimedia.org/wiki/File:Rodan_half_size_flying_model.png) | Toho Co., Ltd. |
| `rodan-model-1956.jpg` | [Rodan model 1.png](https://commons.wikimedia.org/wiki/File:Rodan_model_1.png) | Toho |
| `mothra-larva-tokyo-tower-1961.jpg` | [Larvae Mothra climbing Tokyo Tower.jpg](https://commons.wikimedia.org/wiki/File:Larvae_Mothra_climbing_Tokyo_Tower.jpg) | Toho |
| `mothra-imago-flying-1961.jpg` | [Mosura trailer - Mothra flying (cropped).png](https://commons.wikimedia.org/wiki/File:Mosura_trailer_-_Mothra_flying_(cropped).png) | Toho |
| `ebirah-1966.jpg` | [Ebirah.jpg](https://commons.wikimedia.org/wiki/File:Ebirah.jpg) | Maron Films |
| `godzilla-1954-behind-scenes.jpg` | [Gojira (1954) - Behind Scenes 6.jpg](https://commons.wikimedia.org/wiki/File:Gojira_(1954)_-_Behind_Scenes_6.jpg) | Unknown |

## 2. Not committed — fair use (`refs/fair-use/`, gitignored)

Commons has no free image for these monsters, so the suit stills come from
Wikizilla, where they are non-free fair-use images. They are downloaded to
`refs/fair-use/` for local reference only and deliberately excluded by
`.gitignore` — **do not commit them and do not embed them in the game.**
Re-fetch with the URLs below.

| File | Subject | Source URL |
|---|---|---|
| `anguirus-roar-1955.ogg` | Anguirus roar, reference for the synth roar | `https://wikizilla-images.s3.us-east-va.perf.cloud.ovh.us/b/b5/Anguirus_55_new.ogg` |
| `ebirah-showa.png` | Ebirah Showa suit | `https://wikizilla-images.s3.us-east-va.perf.cloud.ovh.us/e/ec/Ebirah04.png` |
| `gigan-showa.jpg` | Gigan Showa suit — saw, visor, sails | `https://wikizilla-images.s3.us-east-va.perf.cloud.ovh.us/0/02/Gigan1wx3.jpg` |
| `hedorah-showa.jpg` | Hedorah Perfect Stage — eye design | `https://wikizilla-images.s3.us-east-va.perf.cloud.ovh.us/b/bb/Godzilla.jp_-_Hedorah_2004.jpg` |
| `king-ghidorah-heisei.jpg` | Heisei King Ghidorah — neck/head proportions | `https://wikizilla-images.s3.us-east-va.perf.cloud.ovh.us/b/bd/Vlcsnap-2021-10-22-09h36m21s456.png.jpg` |
| `biollante-flower-beast.png` | Biollante Flower Beast — rose, vines, nucleus sac | `https://wikizilla-images.s3.us-east-va.perf.cloud.ovh.us/7/74/Godzilla_vs._Biollante_-_Flower_Beast_Form_Biollante.png` |
| `mothra-roar-1961.ogg` | Mothra roar, reference for the synth roar | `https://wikizilla-images.s3.us-east-va.perf.cloud.ovh.us/3/36/Mothra_%281961%29_Roar_01.ogg` |
| `rodan-showa.jpeg` | Rodan Showa silhouette | `https://wikizilla-images.s3.us-east-va.perf.cloud.ovh.us/7/78/Rodan_2026.jpeg` |
| `spacegodzilla-combat.jpg` | SpaceGodzilla — shoulder crystals, purple abdomen | `https://wikizilla-images.s3.us-east-va.perf.cloud.ovh.us/8/80/SpaceGodzilla_0.jpg` |
| `destoroyah-perfect.jpg` | Destoroyah Perfect Form — horn, pincer tail | `https://wikizilla-images.s3.us-east-va.perf.cloud.ovh.us/4/4e/Destoroyah_0.jpg` |

Fetch them with:

    mkdir -p refs/fair-use && cd refs/fair-use
    # copy any Source URL from the table above
    curl -L -A "art-reference" "<url>" -o <file>

## Not usable

Searched Commons and found nothing free for: Biollante, SpaceGodzilla,
Destoroyah, Hedorah, Gigan, Mechagodzilla. (`Macar gigan` hits are a Swedish
word for swan; `Hedorah star` is a star named after the monster.)

## Note on process

The model used to write this project cannot view images, so the procedural art
in `js/art.js` is driven from the written silhouette briefs in
`docs/research.md` rather than from pixel-matching these files. A human artist
should treat this folder as the ground truth for corrections.
