$root = 'D:\DOWNLOADS\ViraWear-ConnectFINAL-main\ViraWear-ConnectFINAL-main'
$files = Get-ChildItem -Path $root -Include *.html,*.js,*.css,*.md,*.json -Recurse |
    Where-Object { $_.FullName -notmatch 'node_modules' }

foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw -Encoding UTF8
    if ($content -match 'ViraWear') {
        $newContent = $content -replace 'ViraWear Connect', 'WajraConnect' -replace 'ViraWear', 'WajraConnect'
        Set-Content -Path $f.FullName -Value $newContent -Encoding UTF8 -NoNewline
        Write-Host "Updated: $($f.Name)"
    }
}
Write-Host "Done."
