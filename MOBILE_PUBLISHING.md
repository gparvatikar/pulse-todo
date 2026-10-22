# Pulse ToDo — Google Play & Apple App Store Publishing Guide

Your **Pulse ToDo** app (`com.pulsetodo.app`) is now configured with automated cloud build & code-signing pipelines, pre-rendered store graphic assets, and an interactive **Store Publishing Center**.

> **Open Your Interactive Store Publishing Center:**
> Visit **`http://localhost:3000/store-publish.html`** in your browser to download all required icons, banners, and `1080 × 1920` phone screenshots with one click, copy-paste your store listing metadata, and track your submission checklist.

---

## 1. What Has Been Prepared for Store Submission

1. **Interactive Store Publishing Hub (`public/store-publish.html`)**:
   - **1-Click Store Graphic Downloads**:
     - Google Play Hi-Res Icon (`512 × 512 px` PNG — `public/icons/icon-512.png`)
     - Google Play Feature Graphic Banner (`1024 × 500 px` PNG — `public/icons/feature-graphic-1024x500.png`)
     - Apple App Store Master Icon (`1024 × 1024 px` Non-Transparent RGB PNG — `public/icons/icon-1024.png`)
   - **1-Click Store Phone Screenshot Generator (`1080 × 1920 px`)**:
     - Generates and downloads 4 store-compliant 9:16 portrait promotional phone screenshots (*Today Focus*, *Smart Routines*, *Color Categories*, and *Dark Mode & Offline*).
   - **Copy-Paste Store Metadata & Questionnaire Answers**:
     - Pre-written Title, Subtitle, Short Description, Promotional Text, Full Description, Keywords, and Data Safety / App Privacy answers.

2. **Automated Android Production Signing (`.github/workflows/mobile-release.yml`)**:
   - Compiles your Capacitor Android release (`app-release.aab` and `app-release.apk`) in GitHub Actions.
   - Automatically generates a production RSA-2048 upload keystore (`pulse-todo-upload-key.jks`)—or uses your `ANDROID_KEYSTORE_BASE64` secret—and signs both:
     - `pulse-todo-signed.aab` (Ready to upload directly to **Google Play Console**)
     - `pulse-todo-signed.apk` (Ready to install directly on any Android phone)

3. **Zero-Mac Cloud iOS Signing & TestFlight Upload (`codemagic.yaml`)**:
   - Connects to **Codemagic** (free macOS M2 build machines) so you can sign your iOS `.ipa` and push directly to **Apple App Store Connect / TestFlight** from your Windows laptop without owning a Mac.

---

## 2. Publishing to Google Play Store (From Your Windows Laptop)

### Step A: Generate Your Signed `.aab` in the Cloud
1. Go to [github.com/new](https://github.com/new) and create a new repository (e.g., `pulse-todo`).
2. Click **"uploading an existing file"** and drag-and-drop the files from your `TodoApp` folder (make sure to include the `.github` folder, `public`, `scripts`, `capacitor.config.json`, and `package.json`).
3. Click **Commit changes**.
4. Open the **Actions** tab in your GitHub repository. The **Build & Sign Mobile App** workflow will run automatically.
5. Once complete (~3 minutes), download **`pulse-todo-google-play-signed-bundle.zip`**, which contains:
   - `pulse-todo-signed.aab` *(Upload this to Google Play Console)*
   - `pulse-todo-signed.apk` *(Install directly on Android devices)*
   - `pulse-todo-upload-key.jks` & `KEYSTORE_CREDENTIALS.txt` *(Keep safe for future app updates)*

### Step B: Submit in Google Play Console
1. Sign in to [Google Play Console](https://play.google.com/console) ($25 one-time registration fee) and click **Create app**.
2. Enter **App name**: `Pulse ToDo — Tasks & Routines`, **App or game**: `App`, **Free or paid**: `Free`.
3. Under **Grow → Store presence → Main store listing**:
   - Copy-paste the Short Description and Full Description from `http://localhost:3000/store-publish.html`.
   - Upload `icon-512.png`, `feature-graphic-1024x500.png`, and the 4 downloaded `1080 × 1920` phone screenshots.
4. Under **Policy → App content**:
   - **Privacy Policy**: Paste the public URL where your `public/privacy.html` is hosted (e.g., via GitHub Pages).
   - **Data Safety**: Select **"No, my app does not collect or share any of the required user data types"**.
   - **App Access**: Select **"All functionality in my app is available without any access restrictions"**.
5. Under **Release → Production** (or **Closed testing**):
   - Click **Create new release**, upload `pulse-todo-signed.aab`, paste the release notes from `store-publish.html`, and click **Start rollout**.

---

## 3. Publishing to Apple App Store (From Your Windows Laptop — No Mac Required)

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. In the [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list), register a new App ID with **Bundle ID**: `com.pulsetodo.app`.
3. In [App Store Connect](https://appstoreconnect.apple.com), go to **My Apps → (+) New App** and create the app record using `com.pulsetodo.app`.
4. Sign in to [Codemagic.io](https://codemagic.io) using your GitHub account and select your `pulse-todo` repository.
5. Codemagic automatically detects `codemagic.yaml`. Under **Integrations**, connect your **App Store Connect API Key** (generated in App Store Connect → *Users and Access → Integrations → App Store Connect API*).
6. Click **Start new build** in Codemagic. Codemagic will spin up a macOS M2 machine, inject your `1024 × 1024` icon, sign the iOS `.ipa`, and upload it straight to **TestFlight / App Store Connect**.
7. In App Store Connect, copy-paste the Subtitle, Promotional Text, Keywords, and Description from `http://localhost:3000/store-publish.html`, upload the 4 phone screenshots, select your uploaded build, and click **Add for Review**.
