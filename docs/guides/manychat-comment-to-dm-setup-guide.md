# Manychat Comment-to-DM Setup Guide — BSE Nexus

**Goal:** someone comments `ALERTS` on a @bsenexus reel/post → Manychat auto-DMs them a link to bsenexus.in. (The "Comment APP" growth loop.)

Researched Oct 2026 from Manychat's help center + current pricing pages. Anything marked **(verify)** — confirm the exact label in the Manychat dashboard, UI wording drifts.

---

## Part 1 — Prerequisites

- `@bsenexus` must be an Instagram **Professional** account (Business or Creator). Check in the Instagram app: Settings → Account type and tools → Switch account type. Free to switch.
- Recommended: add the IG account to a **Meta Business Portfolio** and link it to a Facebook Page, then connect **via Meta** (unlocks all triggers; the quick "via Instagram" connect limits some features like follow-to-DM).

## Part 2 — Connect Instagram to Manychat

1. Go to **manychat.com** → sign up. **Sign in with Facebook** — most reliable for permission sync.
2. Dashboard sidebar → **Settings → Channels → Instagram → Connect**.
3. Choose **Connect Via Meta** (recommended) or **Connect Via Instagram**.
   - Via Meta: pop-up → select the Business IG account (`@bsenexus`) → **Continue** → review permissions → **Save**.
   - Via Instagram: review permissions → **Allow**.
4. **Keep every permission box checked.** Unchecking even one (e.g. "Manage conversations") silently breaks automation.
5. Answer the onboarding questions → **Let's Start**.
6. If connected via Meta, verify **Conversation Routing** (one-time):
   Meta Business Suite → **Settings → Integrations → Conversation Routing** → click the IG account → **Routing** tab → Default routing → three-dot menu → **Edit** → select **Manychat-IG** in the "Send conversation to" dropdown → **Save**. Then **Partner apps** tab → **Manage** next to Manychat-IG → all permission toggles ON → **Save**. Make sure **no other app** has "Take control of conversation" turned on.
7. Smoke test: **Automation → New Automation** → keyword trigger `hello` → reply "System active" → comment `hello` from a *different* personal account → confirm the DM fires.

## Part 3 — Build the "Comment ALERTS" automation

1. Sidebar → **Automation** tab → **+ New Automation** → **+ Start From Scratch** → **Start with a blank** option.
2. Flow Builder opens → **+ New Trigger** → **Instagram** tab → **User comments on your Post or Reel**.
3. Scope — pick one:
   - **Specific post or reel** (safest to start — select the reel carrying the CTA),
   - **All posts or reels**, or
   - **Next post or reel** (only the next thing you publish).
4. Keywords → **Include certain words into the list of keywords** → add `ALERTS`, `alerts`, plus common misspellings: `ALERT`, `ALARTS`. Use **"Message contains"** matching so "ALERTS please" also fires. (Optional: add an **exclude** list for words that should *not* trigger it.)
5. Public reply (recommended): add 2–3 reply variations, e.g. "Sent! Check your DMs 📩" — Manychat rotates them randomly so it doesn't look bot-like.
6. Click **Save**.
7. In the flow canvas, edit the default DM step:
   - Turn **Send as a Private Reply** ON (required — the automation cannot be published without it).
   - Text: short and personal, e.g. "Here's your instant filing-alerts setup 👇"
   - Add a **Button** → action **Open website** (verify exact label) → URL `https://bsenexus.in` → button text e.g. "Open BSE Nexus".
   - Why the button matters: just sending a link does NOT open Instagram's 24-hour messaging window. The user must tap a button or quick reply to opt in — only then can you send follow-ups later. The button is the mechanism, not just convenience.
8. Top-right → **Set Live** to publish.
9. Test end-to-end from a second account: comment `ALERTS` on the reel → DM should arrive with a working, tappable link.

**Trigger limits:** the comment trigger does NOT work on ads created in Meta Ads Manager, or on remix/collaborative posts where @bsenexus is not the original poster. Regular and boosted posts/reels only.

## Part 4 — Free tier: is it enough?

- **Free ($0, forever):** 25 active contacts/month, 4 automations, 2 channels (pick Instagram + one more), Manychat branding on the first message. An "active contact" = one unique person who interacts with any automation in the billing month.
- **Reality check:** one decent reel can burn through 25 contacts in hours. Free is fine for *testing* the loop; real use needs **Essential** ($14/mo billed yearly, $17 month-to-month — 250 contacts) or **Pro** ($29/mo yearly, $39 monthly — 2,500 contacts, adds WhatsApp/SMS/email + AI).
- Watch the toggle: Manychat's pricing page opens on the **Annual** view — month-to-month billing is higher.

## Part 5 — Compliance: stay on the safe side

- ✅ **Allowed:** auto-DM *in response to a user action* (comment keyword, story reply, incoming DM) through Meta's official API. The line is "official API + user-initiated = compliant."
- ❌ **Never:** cold-DM people who never interacted; auto-comment on *other people's* posts (Meta's API doesn't permit it — tools that do it are scraping, and accounts get action-blocked or suspended).
- **Deliver what the CTA promises.** The DM must contain the thing the comment offered. Bait with no delivery = engagement-bait flags.
- Don't blast identical DMs at high velocity; Instagram rate-limits automated DMs. Stay well under any published hourly cap.
- Never buy comments/likes to seed the trigger — inauthentic engagement gets reach throttled, not boosted.
- One Instagram account per Manychat account. A second IG needs a separate Manychat account (switch via profile picture → Manage accounts).

## Quick checklist for Rahul

- [ ] @bsenexus switched to Professional (Business/Creator) account
- [ ] Manychat account created (sign in with Facebook)
- [ ] Instagram connected via Meta, all permissions granted, routing set to Manychat-IG
- [ ] "Comment ALERTS" automation built: keywords include misspellings, "Send as a Private Reply" ON, button with bsenexus.in link
- [ ] Tested from a second account, set live
- [ ] Decide: stay on Free for the test, upgrade to Essential ($14/mo yearly) when contacts exceed 25/month
