$path = $MyInvocation.MyCommand.Path
if ($path)  {$path = Split-Path $path -Parent}
Set-Location $path

$env:SNAPSHOT_BUNDLER='C:\Users\User\dev\esbuild\snapshot.exe'
$env:SNAPSHOT_KEEP_CONFIG=1
node ./snapshot/install-snapshot.js

$env:DEBUG='(pack|snap)*(info|debug|error)*'
$env:PROJECT_BASE_DIR=Get-Location
.\node_modules\electron\dist\electron.exe --inspect-brk -r ./app/hook-require.js ./app/index.js
