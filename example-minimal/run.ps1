$path = $MyInvocation.MyCommand.Path
if ($path)  {$path = Split-Path $path -Parent}
Set-Location $path

$env:SNAPSHOT_BUNDLER='C:\Users\User\dev\esbuild\snapshot.exe'
$env:SNAPSHOT_KEEP_CONFIG=1
node ./snapshot/install-snapshot.js

$env:DEBUG='(pack|snap)*(info|debug|error)*'


//
// Set env
//
$env:ELECTRON_RUN_AS_NODE=1

$env:PROJECT_BASE_DIR=Get-Location
.\node_modules\electron\dist\electron.exe -r ./app/hook-require.js ./app/index.js


//
// Clean env
//
Remove-Item env:ELECTRON_RUN_AS_NODE
