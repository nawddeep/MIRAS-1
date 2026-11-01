# Demo day runbook

One page. Plain language. Written from the code and `BUILD_LOG.md`, not from hope. The phone checklist is `docs/PHONE_TEST.md`; do that first.

## 1. Ten checks, ten minutes before you present

1. The server runs in production mode (`npm run start`, never `npm run dev`) and its terminal is visible.
2. The HTTPS tunnel is up and its address opens on both phones. Do not restart the tunnel after installing the home-screen icon: a quick tunnel gets a new address each time, and the old icon stops working.
3. `<address>/admin` says **Gemini configured** with the right model name. That only proves the values are set. Take one camera photo of a real place: it must come back with the right match, and the terminal must show no `[ai]` lines.
4. Demo mode is on: the dark "Demo mode" bar shows at the top of the pages.
5. Both phones are charged, screen lock is long, notifications are off, volume is up. Play one story's audio to check.
6. The backup screen recording is on the phone and plays with sound.
7. The MIRAS icon is installed on the home screen and opens full screen.
8. Mic and camera are already allowed for this address: open Onboarding and Camera once on each phone.
9. Test data is cleared. Stop the server, run `mv data data-test`, start it again. This removes test enquiries, test listings and uploaded photos. Sample content is not affected.
10. Do not hammer the buttons. Limits per phone: camera 20 photos a minute, voice drafts 10 in 10 minutes, enquiries 3 in 10 minutes. "Too many requests" means wait.

## 2. The 60-second path

| Step | Show | Say |
|---|---|---|
| 1 (5 s) | Home | "MIRAS follows Udaipur's own time of day." |
| 2 (10 s) | Places, Pichhola, tap "360° preview" | "Preview a place in 360. This picture is a placeholder, so it says Illustrative." |
| 3 (10 s) | A story, tap play | "Every story says where it comes from, history, oral tradition or legend, and who checked it. These are samples, so it says Sample content. The voice is synthetic, and it says so." |
| 4 (15 s) | Camera: one place, then an unrelated photo | "The camera only picks from our list of places and never writes history. If it is not sure, it says: I don't know this one yet." |
| 5 (10 s) | Makers, a maker, send an enquiry | "Makers appear only with recorded consent. Visitors send an enquiry. No payment happens in the app." |
| optional (15 s) | Voice onboarding | "A maker describes their craft out loud, the assistant drafts a listing, and nothing goes public until they confirm." |

## 3. If Gemini fails on stage

Be exact about what the app does. It does **not** switch to demo responses by itself.

- Camera: shows "I don't know this one yet", the same as a photo it cannot place. If a clear photo keeps getting that, look at the terminal for an `[ai]` line.
- Voice: "The assistant is not reachable right now. Please fill in the form yourself." and the typed form opens. Use it.
- Plan B, about ten seconds: stop the server and start it again with `GEMINI_MODEL= npm run start`. The tunnel can stay up. The camera then shows place buttons labelled **Demo response**, and voice drafts are labelled **Demo response**.
- Say it plainly: "This part is running in demo mode, so what you see is a labelled placeholder, not live AI." Do not pretend it is live.

## 4. If the network dies

Switch to the screen recording and say it is a recording. Places you saved with "Save for offline" before the demo still open under "Offline copies". Nothing else works offline.

## 5. The honesty line

"Everything labelled Sample content is placeholder. Nothing marked sample is real."

## 6. What is real and what is not

**Real: built and tested on a laptop, but not yet on a real phone.**
- The rules: a story shows only if a named person verified it (samples show only in demo mode, always badged). A maker goes public only with recorded consent and their own confirmation.
- Enquiries are saved in a database on the laptop and shown to the maker on their private page. No email or text message is sent.
- Camera and voice onboarding use Gemini when the key and exact model name are set. Until the phone test is done, treat live AI as unproven: it has never run with the team's real key.
- Working features on sample content: places, stories, makers, workshops, trails, audio walks, passport stamps, memories, saving for offline.

**Not real: placeholder, unverified or unfinished.**
- All places, stories, makers, workshops, events, trails and phrases are sample text ("SAMPLE: … goes here"). No history has been checked by a person yet.
- Opening hours, entry fees and coordinates are not verified. The trip planner refuses to plan with the sample places for that reason.
- The pictures are supplied illustrations whose rights are not independently verified, and all are small (358 pixels wide or less), so they look soft on a phone. The 360 view is a generated placeholder, labelled Illustrative.
- The camera is not calibrated. Its result says "Suggested match · not independently verified".
- The Hindi lines from the design are drafts that still need a native speaker.
- No real maker has given consent. Consent in the app is a tick box.
- "Story view (concept)" is not AR. Bookings and payments are not built.
