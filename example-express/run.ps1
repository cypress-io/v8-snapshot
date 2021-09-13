$path = $MyInvocation.MyCommand.Path
if ($path)  {$path = Split-Path $path -Parent}
Set-Location $path

$env:SNAPSHOT_BUNDLER='C:\Users\User\dev\v8-snapshot\esbuild\snapshot.exe'
$env:SNAPSHOT_KEEP_CONFIG=1
$env:DEBUG='(pack|snap)*(info|debug|error)*'

node ./snapshot/install-snapshot.js
.\node_modules\electron\dist\electron.exe -r ./app/hook-require.js ./app/index.js
