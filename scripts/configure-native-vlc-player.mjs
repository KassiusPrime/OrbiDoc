import fs from 'node:fs/promises';
import path from 'node:path';

const generatedJavaDir = path.resolve('android/app/src/main/java/app/orbidoc/workspace');
const pluginPath = path.join(generatedJavaDir, 'OrbiDocNativePlugin.java');
const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');
const gradlePath = path.resolve('android/app/build.gradle');
const activityTemplatePath = path.resolve('native/android/OrbitVlcPlayerActivity.java');
const pluginMethodsPath = path.resolve('native/android/OrbitVlcPluginMethods.java');
const dependency = 'implementation "org.videolan.android:libvlc-all:3.6.1"';

await fs.mkdir(generatedJavaDir, { recursive: true });
let plugin = await fs.readFile(pluginPath, 'utf8');
const methods = await fs.readFile(pluginMethodsPath, 'utf8');
if (!plugin.includes('supportsNativeVlcPlayer(PluginCall call)')) {
  const marker = '  @PluginMethod\n  public void consumeOpenFile(PluginCall call) {';
  if (!plugin.includes(marker)) throw new Error('Não foi encontrado o ponto de inserção do plugin nativo Orbit.');
  plugin = plugin.replace(
    'import com.getcapacitor.JSObject;',
    'import com.getcapacitor.ActivityResult;\nimport com.getcapacitor.JSObject;',
  );
  plugin = plugin.replace(
    'import com.getcapacitor.annotation.CapacitorPlugin;',
    'import com.getcapacitor.annotation.ActivityCallback;\nimport com.getcapacitor.annotation.CapacitorPlugin;',
  );
  plugin = plugin.replace(marker, methods + '\n' + marker);
  await fs.writeFile(pluginPath, plugin, 'utf8');
}

const activityPath = path.join(generatedJavaDir, 'OrbitVlcPlayerActivity.java');
const activityTemplate = await fs.readFile(activityTemplatePath, 'utf8');
await fs.writeFile(activityPath, activityTemplate, 'utf8');

let gradle = await fs.readFile(gradlePath, 'utf8');
if (!gradle.includes('org.videolan.android:libvlc-all:')) {
  const dependenciesMarker = /dependencies\s*\{/;
  if (!dependenciesMarker.test(gradle)) throw new Error('Não foi encontrado o bloco dependencies de android/app/build.gradle.');
  gradle = gradle.replace(dependenciesMarker, (match) => match + '\n    ' + dependency);
  await fs.writeFile(gradlePath, gradle, 'utf8');
}

let manifest = await fs.readFile(manifestPath, 'utf8');
if (!manifest.includes('app.orbidoc.workspace.OrbitVlcPlayerActivity')) {
  const activity = [
    '        <activity',
    '            android:name="app.orbidoc.workspace.OrbitVlcPlayerActivity"',
    '            android:exported="false"',
    '            android:configChanges="orientation|screenSize|keyboardHidden|smallestScreenSize"',
    '            android:screenOrientation="sensor"',
    '            android:theme="@android:style/Theme.Material.NoActionBar" />',
    ''
  ].join('\n');
  if (!manifest.includes('</application>')) throw new Error('AndroidManifest.xml não contém </application>.');
  manifest = manifest.replace('</application>', activity + '    </application>');
  await fs.writeFile(manifestPath, manifest, 'utf8');
}

console.log('Orbit native player: LibVLC 3.6.1 dependency, activity, playlist picker and plugin bridge configured.');
