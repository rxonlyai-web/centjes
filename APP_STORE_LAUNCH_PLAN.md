# App Store Launch Plan — Centjes

Bundle ID: `eu.centjes.app` | App Name: Centjes | iOS 16.0+

---

## Prerequisites

> All items in this section require action outside Claude Code.

- [ ] **Apple Developer Program membership** ($99/year) — enroll at [developer.apple.com](https://developer.apple.com/programs/) if not already a member
- [ ] **Privacy Policy URL** — required by Apple; must be publicly accessible (e.g. `centjes.eu/privacy`)
- [ ] **Support URL** — a public page where users can get help (e.g. `centjes.eu/support`)
- [ ] **App Store screenshots** — minimum set per device size:
  - iPhone 6.7" (1290×2796) — required
  - iPhone 6.5" (1284×2778) — required
  - iPad 12.9" (2048×2732) — if supporting iPad
  - Use Simulator (`xcrun simctl`) or a real device to capture these
- [ ] **App icon source** — current `AppIcon-512@2x.png` exists; verify it meets Apple's 1024×1024 requirement (no transparency, no rounded corners)

---

## Phase 1: Apple Developer & Signing Setup

> These steps are done in Xcode and Apple Developer portal.

- [ ] **Create App ID** in [Apple Developer portal](https://developer.apple.com/account/resources/identifiers/list) for `eu.centjes.app`
- [ ] **Create provisioning profile** (App Store Distribution) for `eu.centjes.app`
- [ ] **Set Development Team** in Xcode: open `ios/App/App.xcodeproj`, go to Signing & Capabilities, select your team
- [ ] **Verify automatic signing** resolves — Xcode should show a valid signing certificate and provisioning profile

```bash
# Open Xcode project
npm run cap:open
```

---

## Phase 2: App Store Connect Setup

> All done at [appstoreconnect.apple.com](https://appstoreconnect.apple.com).

- [ ] **Create new app** in App Store Connect
  - Platform: iOS
  - Name: Centjes
  - Primary language: Dutch
  - Bundle ID: eu.centjes.app
  - SKU: centjes-app (or similar unique string)
- [ ] **Fill in app metadata**:
  - Subtitle (max 30 chars): e.g. "Boekhouding. Simpel."
  - Category: Finance
  - Secondary category: Business
  - Description (Dutch + English if targeting both)
  - Keywords (comma-separated, max 100 chars): e.g. "boekhouding,zzp,btw,facturen,freelancer,belasting,administratie"
  - Privacy Policy URL
  - Support URL
- [ ] **Age Rating** — fill in the questionnaire (likely 4+, no objectionable content)
- [ ] **Pricing** — set price tier (Free or paid)
- [ ] **Upload screenshots** for each required device size

---

## Phase 3: Prepare the Build

These steps can be done in Claude Code and Xcode.

### 3a. Version & Build Number

Update version in Xcode project (currently 1.0 build 1). For first submission, 1.0 (1) is fine.

### 3b. Sync Web Assets

```bash
npm run build
npm run cap:sync
```

### 3c. Privacy Manifest (if needed)

Apple requires a `PrivacyInfo.xcprivacy` file declaring API usage. Capacitor includes one for its own APIs. If the app uses any [required reason APIs](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api) beyond what Capacitor declares, a custom manifest is needed.

> Check during Xcode archive — Xcode 15+ shows privacy manifest warnings.

### 3d. Verify Info.plist

Current privacy descriptions (already set, in Dutch):
- `NSCameraUsageDescription` — camera for receipt scanning
- `NSPhotoLibraryUsageDescription` — photo library access
- `NSPhotoLibraryAddUsageDescription` — photo library write

These look good for App Review.

---

## Phase 4: Archive & Upload

> Done in Xcode.

- [ ] **Select "Any iOS Device (arm64)"** as build destination (not a simulator)
- [ ] **Product → Archive** to create an App Store archive
- [ ] **Distribute App → App Store Connect** in the Organizer window
- [ ] Wait for Apple to process the build (usually 15-30 minutes)
- [ ] Build appears in App Store Connect under TestFlight and the App Store submission

Alternatively, from the command line:

```bash
# Archive
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release -archivePath build/Centjes.xcarchive archive

# Export for App Store
xcodebuild -exportArchive -archivePath build/Centjes.xcarchive -exportPath build/export -exportOptionsPlist ExportOptions.plist
```

> An `ExportOptions.plist` file would need to be created with the distribution method set to `app-store-connect`.

---

## Phase 5: TestFlight (Recommended)

> Done in App Store Connect.

- [ ] **Add internal testers** (your Apple ID + any team members)
- [ ] **Test the build** via TestFlight on a real device — verify:
  - Google OAuth login works
  - Camera capture works for receipt scanning
  - Navigation and all dashboard pages load correctly
  - Push to centjes.eu works (the app is a web wrapper)
  - Deep linking via `centjes://` scheme works
- [ ] **Optional: add external testers** — requires a brief App Review for TestFlight

---

## Phase 6: Submit for Review

> Done in App Store Connect.

- [ ] **Select the processed build** under the App Store tab
- [ ] **Add Review Notes** — explain to the reviewer:
  - The app requires a Google account to sign in
  - Provide a demo account if possible, or explain the sign-up flow
  - Mention the app is a financial tool for Dutch freelancers
- [ ] **Submit for Review**
- [ ] App Review typically takes 1-3 days

---

## Phase 7: Post-Launch

- [ ] **Monitor App Store Connect** for review status
- [ ] **Respond to any rejections** — common reasons for Capacitor/web-wrapper apps:
  - **Guideline 4.2 (Minimum Functionality)**: Apple may reject if the app doesn't offer enough beyond the website. Mitigate by highlighting native features: camera scanning, push notifications (if added), offline capability
  - **Guideline 4.7 (HTML5 Games/Apps)**: WebView apps must provide significant native value
  - If rejected, consider adding native-only features (biometric auth, widgets, push notifications)
- [ ] **Set up crash reporting** (Xcode Organizer or a third-party tool)
- [ ] **Plan update cadence** — each new deploy to centjes.eu is automatically reflected in the app (since it's a web wrapper), but native changes require a new App Store build

---

## Risk: Web Wrapper Rejection

Apple has been known to reject apps that are primarily web wrappers (Guideline 4.2). The current app points to `centjes.eu` via Capacitor's server URL. To strengthen the case for approval:

1. **Camera integration** is already a native feature (receipt scanning) — highlight this
2. Consider adding before submission:
   - **Face ID / Touch ID** lock for the app
   - **Push notifications** for tax deadlines
   - **Home screen widgets** showing financial summaries
   - **Offline mode** for viewing recent transactions

These additions would significantly improve approval chances and user experience.
