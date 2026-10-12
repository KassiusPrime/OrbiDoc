# Third-party notices

## LibVLC Android — version 3.6.1

Orbit's Android Player can link the official LibVLC Android library using the Maven artifact
`org.videolan.android:libvlc-all:3.6.1`.

- Upstream project: https://code.videolan.org/videolan/vlc-android
- LibVLC Android development/documentation: https://wiki.videolan.org/LibVLC/
- License information and source are maintained by VideoLAN in the upstream repository; the LibVLC library is distributed under LGPL terms (commonly LGPL-2.1 for this artifact). Verify the license files shipped with the exact dependency before distributing a release.
- The full VLC Android application and its brand are separate from LibVLC. Orbit does not copy VLC application code, artwork, name, or user interface. This native integration only uses the published library and an independently implemented Orbit UI.

The dependency must remain replaceable and independently versioned. Preserve the applicable license text, copyright notices, source availability obligations, and any relinking/reverse-engineering rights required by the exact LGPL version. Before publishing a production APK/AAB, verify the final AAR's license metadata and include all required notices/source materials; this note is not a substitute for that release check.
