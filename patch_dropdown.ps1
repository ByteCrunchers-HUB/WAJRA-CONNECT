$root = 'D:\DOWNLOADS\ViraWear-ConnectFINAL-main\ViraWear-ConnectFINAL-main'
$files = @('dashboard.html', 'settings.html', 'gps.html', 'alert.html', 'livestream.html') | ForEach-Object { Join-Path $root $_ }

$newDropdown = @'
    <!-- User Dropdown Menu -->
    <div id="userDropdown" class="glass" style="position: fixed; bottom: 80px; left: 20px; width: 240px; padding: 20px; z-index: 1000; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-subtle);">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--secondary)); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; color: #000;" id="dropdownAvatar">--</div>
            <div>
                <div id="dropdownName" style="font-weight: 600; font-size: 15px;">User</div>
                <div id="dropdownEmail" style="font-size: 12px; color: var(--text-dim);">email@example.com</div>
            </div>
        </div>
        <button class="btn-settings-mini" onclick="window.location.href='settings.html'">⚙️ Settings</button>
        <button id="logoutBtn" class="btn-logout">🚪 Sign Out</button>
    </div>
'@

foreach ($f in $files) {
    if (-Not (Test-Path $f)) { Write-Host "NOT FOUND: $f"; continue }
    $content = Get-Content $f -Raw -Encoding UTF8
    
    # regex match for everything between <!-- User Dropdown Menu --> and </div> that precedes <script src="auth.js">
    # Note: replacing the whole block
    $content = [regex]::Replace($content, '(?s)<!--\s*User Dropdown Menu\s*-->.*?</div>\s*(?=<script src="auth\.js")', $newDropdown + "`n    ")
    Set-Content -Path $f -Value $content -Encoding UTF8 -NoNewline
    Write-Host "Patched dropdown: $(Split-Path $f -Leaf)"
}

Write-Host "Dropdown update complete."
