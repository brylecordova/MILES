# CertiField Native Android App

Native Kotlin + Jetpack Compose Android client with full **offline course storage** and **ExoPlayer (Media3)** local video playback.

## Build the APK in the Cloud (No Android Studio Required)

If your computer cannot run Android Studio smoothly, you can compile the `.apk` for free on GitHub's cloud servers in 3 steps:

1. Extract this zip folder (`android/`) and upload its contents to a new GitHub repository (make sure the `.github/workflows/build-android-apk.yml` file is included).
2. Open the **Actions** tab in your GitHub repository and click **Build Android APK** -> **Run workflow**.
3. Once finished (~2 minutes), download **certifield-android-debug-apk** from the run's **Artifacts** section, transfer `app-debug.apk` to your Android phone, and tap it to install.

### Changing the Server URL
Before uploading to GitHub, you can optionally edit `DEFAULT_SERVER_URL` in `app/build.gradle.kts` to point directly to your deployed Node.js + MongoDB server URL (learners can also change the server URL inside the app's sign-in screen).

### Offline Video Playback
When a learner downloads a course inside the Android app, every lesson video (`.mp4`/`.webm`), image, and quiz is saved inside the app's private local storage (`filesDir/offline_courses/...`). Media3 ExoPlayer streams directly from those local `file://` URIs so videos play reliably with zero Wi-Fi or cellular signal.
