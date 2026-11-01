# MIRAS Stories – AR & VR stories (Next.js)

Instagram-style stories where every story can be **viewed in 360°, VR and AR**:

| Upload | 360 | VR | AR |
|---|---|---|---|
| 360° photo / video (2:1 equirectangular) | look around (drag or move the phone) | split-screen for a phone VR viewer, or a headset via WebXR | a **portal** into the 360 world floats in your room – tap it to step inside |
| Panorama (wide photo, e.g. 4:1) | wrapped around you (choose 90–360°) | same, in stereo | panorama seen through the portal |
| Normal photo / video | flat view | big floating screen in space | a card floating in your room |

* **Max 60 seconds per story.** Photos show for 3–60 s (you choose). Videos longer than 60 s: you pick which 60 s to share (trim slider); the server enforces the limit too.
* Stories last **24 hours**, like Instagram. Tray rings turn grey when you’ve seen everything.
* Tap the right/left edge for next/previous, hold to pause, keyboard ← → Space Esc.
* Reply or react with emoji; owners see **views and replies**; delete your own stories.
* No login in the prototype – switch demo user (top right) to see other people’s view.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
npm run dev:https    # https – needed on a phone for the camera (AR) and motion sensors
```
Open the https address (e.g. `https://192.168.x.x:3000`) on your phone on the same Wi-Fi and accept the certificate warning.

AR uses the phone camera + gyroscope (works on Android and iPhone). Phones/headsets with WebXR get extra
**🥽 Headset** (immersive-vr) and **✨ WebXR AR** (immersive-ar) buttons.

## Mock data
`lib/mock.js` – 8 Udaipur users and 11 stories (360 videos of City Palace, Lake Pichola (53 s), Karni Mata;
360 photos; a 200° panorama; normal photos and a video) using files in `public/mock/`. Mock stories never expire.

## Where things live
* `app/page.js` – story tray + “Step into Udaipur” explore grid
* `app/story/[userId]` → `components/StoryViewer.js` – full-screen viewer, progress bars, modes, replies
* `app/create` → `components/Uploader.js` – upload, 360/panorama auto-detect, 60 s trim, preview
* `lib/immersive.js` – three.js engine: sphere / cylinder / screen, stereo VR, AR portal (stencil), WebXR
* `app/api/stories` – list + upload · `/[id]` delete · `/[id]/view` · `/[id]/react` · `app/api/media/[name]` streams uploads (Range support)
* `lib/db.js` – JSON file store: `data/db.json` + `data/uploads/` (swap for a database + object storage in production)
