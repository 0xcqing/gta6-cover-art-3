# Coastline Heat

A static, offline GTA 6-inspired cover art maker that turns local photos into a four-frame Vice City sunset poster.

[Bounty page](https://make.fun/bounty/gta6-cover-art-01)

[![make.fun competition badge](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![make.fun rank badge](https://make.fun/badge/gta6-cover-art-01/0xcqing/gta6-cover-art-3/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![make.fun reward badge](https://make.fun/badge/gta6-cover-art-01/0xcqing/gta6-cover-art-3/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

## Run

Node 22 or newer is all the app needs. From the repository root:

```powershell
node serve.ts
```

Open `http://localhost:8080`. Photos stay in the browser; the app makes no network requests. Choose a poster shape, add photos by file picker or drag and drop, then tune the crop, caption and subtitle before exporting a PNG.

To package the entry and its dossier outside the repository:

```powershell
$env:MAKEFUN_OUTPUT_DIR = "D:\makefun-work\ca03-verify"
node main.ts
```
