import fs from 'node:fs/promises';
import path from 'node:path';

const mainActivityPath = path.resolve('android/app/src/main/java/app/orbidoc/workspace/MainActivity.java');
const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');

let mainActivity = await fs.readFile(mainActivityPath, 'utf8');
if (!mainActivity.includes('android.view.WindowManager')) {
  mainActivity = mainActivity.replace(
    'import android.os.Bundle;',
    'import android.os.Bundle;\nimport android.view.WindowManager;\nimport androidx.core.view.WindowCompat;',
  );
}

if (!mainActivity.includes('WindowCompat.enableEdgeToEdge')) {
  mainActivity = mainActivity.replace(
    'super.onCreate(savedInstanceState);',
    'super.onCreate(savedInstanceState);\n    WindowCompat.enableEdgeToEdge(getWindow());\n    getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);',
  );
}
await fs.writeFile(mainActivityPath, mainActivity);

let manifest = await fs.readFile(manifestPath, 'utf8');
manifest = manifest.replace(/<activity\b([\s\S]*?)android:name="\.MainActivity"([\s\S]*?)>/, (match) => {
  if (match.includes('android:windowSoftInputMode=')) {
    return match.replace(/android:windowSoftInputMode="[^"]*"/, 'android:windowSoftInputMode="stateAlwaysHidden|adjustResize"');
  }
  return match.replace(/>$/, '\n            android:windowSoftInputMode="stateAlwaysHidden|adjustResize">');
});
await fs.writeFile(manifestPath, manifest);

console.log('Configured Android edge-to-edge + adjustResize for OrbiDoc.');
