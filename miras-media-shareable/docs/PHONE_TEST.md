# Phone test checklist

For the team, on a **real Android phone (Chrome)** and a **real iPhone (Safari)**. About 45 minutes.

**Why this exists.** Everything so far was tested on a laptop. Nothing has been run on a real phone, over HTTPS, with the real Gemini key. A laptop browser set to a phone size is not Safari. Run the tests, paste the results back (last section), and the fixes will come from facts.

## 1. Set up on the laptop

1. Copy the settings file: `cp .env.example .env`, then fill in:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL`: the exact model name from Google AI Studio. If either of these two is empty, the app quietly uses the labelled demo mode instead of Gemini.
   - `ADMIN_PASSCODE`: any passcode you choose.
   - Leave `NEXT_PUBLIC_DEMO_MODE=true`. This one is read when the app is **built**, so if you change it, build again.
2. Build and start in production mode:
   ```
   npm ci
   npm run build
   npm run start
   ```
   The server listens on all network addresses, port 3000, by default (checked). `npm run start -- -H 0.0.0.0 -p 3000` is the same thing spelled out. Do not use `npm run dev` for phone tests: it is slower, and the install and offline features only work in the production build.
3. In a second terminal, start an HTTPS tunnel and open the `https://` address it prints on the phone:
   - `cloudflared tunnel --url http://localhost:3000`, or
   - `ngrok http 3000` (the free plan shows a "Visit site" warning page once; tap through it).

   Phones only allow the camera and microphone on `https://` addresses. Anyone with the link can open the app while the tunnel runs, so do not post it.
4. Open `<tunnel address>/admin`. It should say **Gemini configured** and show your model name. If it says **AI not configured**, a value is missing from `.env`: fix it and restart the server. Careful: "Gemini configured" only means both values are present, not that they work. Test 8 proves it.
5. Keep the server terminal visible. When a Gemini call fails, the server prints one line starting with `[ai]`, for example `[ai] camera/match: model call failed: ApiError (HTTP 400)`. The number points at the cause: 400, 401 or 403 usually means the key or the model name; 404 usually the model name; 429 quota or too many requests; 5xx Google's side. (Only 400 was seen, in a check with a fake key; the others are what Google's API normally returns and are not verified here.) The line never contains the key, the audio or the photos.

## 2. What to run

Run every test on **both** phones. For each one write down: device, OS version, browser version, pass or fail, what happened, a screenshot, and any error text.

- **Getting error text from a phone.** Android Chrome: plug in by USB and open `chrome://inspect` on the laptop. iPhone: Settings, Safari, Advanced, turn on Web Inspector, plug in, then on the Mac open Safari, Develop, your iPhone. If that is too much, copy the message shown on screen and note the time; the server terminal shows the matching `[ai]` line.
- **Before you start**, count the files in `data/uploads` if that folder exists. Test 9 checks the count does not grow.

| # | Test | What to do | Expected |
|---|---|---|---|
| 1 | Open the HTTPS address | Open it in the phone browser. Tap the intro to skip it. Scroll Home, Places, a place, Stories, Camera. | Loads. No sideways scrolling. Hindi (Devanagari) text and images load. Nothing jumps while loading. The bottom bar sits above the phone's home bar. |
| 2 | Home theme | On Home, open "Make it your hour" and tap Dawn, Day, Golden, Night (or add `?hour=7`, `?hour=17`, `?hour=22` to the address). | The picture and headline match the time of day in Udaipur (India time, not the phone's clock). The preview links change the look. `?hour=` only works in demo mode. |
| 3 | Add to Home Screen | iPhone: Share, Add to Home Screen. Android: browser menu, Install app (or the "Install MIRAS" box). Then open it from the new icon. | Opens full screen with no browser bar, named MIRAS, with the MIRAS icon. |
| 4 | Demo path | Home, Places, Pichhola, tap "360° preview" and drag, open a story, Makers, Sample Artisan 1, send an enquiry. | Every step works. The 360 view drags without freezing the page. The enquiry shows "Sent. The artisan will reply to you directly." |
| 5 | Voice onboarding, Hindi | Open the footer link "For artisans: create a listing". Tap the mic, allow it, speak about a craft in Hindi for 20 seconds, tap Stop, then "Make my draft". | The mic permission is asked once. After a short wait (write down how many seconds) a review form appears with a title and descriptions in English and Hindi. Fields the AI was unsure about are outlined and marked "Please check". There is **no** "Demo response" label (if there is, the server is not using Gemini). Nothing is public until you tick consent and tap Publish. Use "Save as draft". |
| 6 | Voice onboarding, English | Same as 5, in English. | Same as 5. |
| 7 | Mic denied | On the onboarding page, tap the mic and choose Don't Allow or Block. | A message says the microphone is blocked. "Type instead" opens the form and you can finish by typing. |
| 8 | Camera, every place | Open Camera, tap Scan, allow the camera. Point it at a photo of each place shown on another screen: City Palace, Jagdish Temple, Saheliyon ki Bari, Pichhola, Sajjangarh. Also try "Photo" (takes a picture with the phone's camera app) and "Upload" (from the gallery). | A clear photo of a place gives "Suggested match · not independently verified" with the right name. "View Full Story" opens its story (Saheliyon ki Bari has no story yet, so it opens its place page). If a clear photo gets "I don't know this one yet", read the `[ai]` line in the server terminal. |
| 9 | Camera, wrong photos | Try an unrelated photo (a street, a pet), a dark photo (cover the lens), and a photo where a person is the main subject. | Unrelated: "I don't know this one yet" with a search box. Dark: "That photo is too dark" appears before anything is sent. Person: "I don't know this one yet" with a note about people. Afterwards `data/uploads` has the same number of files as before: camera photos are never saved. |
| 10 | Camera, no permission | Tap Don't Allow for the camera. Separately, if you can reach the plain `http://` laptop address from the phone, open Camera there. | Denied: "The camera is blocked" and a list of places to open instead. Plain `http://`: "The camera needs a secure (https) connection", the same list, and Photo and Upload still work. |
| 11 | Story narration | Open a story (for example Stories, then any story). Tap play. If the story has a Hindi button (हिंदी), tap it and play again. | You hear speech and the "Synthetic voice" label shows. Hindi needs a Hindi voice on the phone (iPhone: Settings, Accessibility, Spoken Content, Voices, Hindi. Android: Settings, Text-to-speech, install Hindi). If there is none, write "no Hindi voice": that is a phone limit, not an app bug. |
| 12 | Slow network | Throttle to 3G. Android Chrome: USB inspect, Network, Slow 3G. iPhone: Settings, Developer, Network Link Conditioner (needs developer mode), or use a weak hotspot. Load Home and a place, then try the camera or voice. | Pages load slowly but are never blank. A slow upload ends with "Slow connection" after about 45 seconds, the recording stays on the phone, and "Type instead" is offered. If the tunnel itself is slow, say so in your notes. |
| 13 | Offline | Load Home once. On a place page tap "Save for offline". Then turn on airplane mode and open another page. | You see "Offline copies" with your saved place and plan, not the browser's error page. Pages you did not save are not available (by design). |
| 14 | Enquiry limit | On a sample maker's page, send 5 different short messages quickly. Then send the same text twice. | The first 3 say "Sent." The 4th says "Too many messages in a short time. Please try again in a few minutes." The same text twice says "You already sent this message." The layout holds. The limit resets after 10 minutes. |
| 15 | Rotate and language | Rotate to landscape and back on Home, a story, the camera and the onboarding review. Switch EN and हिं (top bar; on Home it is under "Make it your hour") while typing an enquiry. | No broken layout. The text switches language. What you typed is still there. |

Test listings and enquiries are stored in `data/` on the laptop. In tests 5 to 7 use "Save as draft". The runbook says how to clear test data before demo day.

## 3. What to paste back

One block per test, in this exact format, so the fixes work from facts:

```
TEST #:
DEVICE / OS / BROWSER:
RESULT: pass | fail
WHAT HAPPENED:
CONSOLE OR SERVER ERROR (exact text):
SCREENSHOT: attached
```

Only write "pass" for a test you ran on that phone. For anything you did not run, write "not run".
