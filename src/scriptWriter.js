/**
 * scriptWriter.js
 * Pure function — takes an array of app objects, returns a startup.bat string.
 * No Electron or Node dependencies so it can be unit-tested standalone.
 */

function generateScript(apps) {
  const enabled = apps.filter(a => a.enabled && a.path && a.path.trim());

  const lines = [
    '@echo off',
    ':: ================================================',
    '::  LoungeStarter — startup script',
    `::  Generated: ${new Date().toLocaleString()}`,
    '::  Managed by LoungeStarter — edit via the app.',
    ':: ================================================',
    '',
  ];

  if (enabled.length === 0) {
    lines.push(':: No apps are enabled. Open LoungeStarter to configure.');
  } else {
    enabled.forEach(app => {
      lines.push(`:: ${app.name}`);
      lines.push(`start "" "${app.path}"`);
      lines.push('');
    });
  }

  lines.push('exit');
  return lines.join('\r\n');
}

module.exports = { generateScript };
