const fs = require('fs');

const files = ['dashboard.html', 'settings.html', 'gps.html', 'alert.html', 'livestream.html'];

const newDropdown = `    <!-- User Dropdown Menu -->
    <div id="userDropdown" class="glass" style="position: fixed; bottom: 80px; left: 20px; width: 240px; padding: 20px; z-index: 1000; gap: 12px; display: none; flex-direction: column;">
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
`;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/<!-- User Dropdown Menu -->[\s\S]*?<\/div>[\s\n]*?(?=<script[^>]*src="auth\.js")/i, newDropdown);
    fs.writeFileSync(file, content);
    console.log('patched ' + file);
}
