const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

// 💡 백엔드 서버(server.cjs)를 일렉트론 실행 시 함께 구동
function startBackendServer() {
    try {
        const appPath = app.getAppPath();
        const dataDirectory = app.getPath('userData');
        const databasePath = path.join(dataDirectory, 'member_management.db');
        const bundledDatabasePath = path.join(appPath, 'server', 'member_management.db');

        fs.mkdirSync(dataDirectory, { recursive: true });
        if (!fs.existsSync(databasePath)) {
            if (!fs.existsSync(bundledDatabasePath)) {
                throw new Error(`기본 데이터베이스 파일을 찾을 수 없습니다: ${bundledDatabasePath}`);
            }
            fs.copyFileSync(bundledDatabasePath, databasePath);
        }

        process.env.MEMBER_MANAGEMENT_DB_PATH = databasePath;
        require(path.join(appPath, 'server', 'server.cjs'));
        console.log('🚀 일렉트론 내부에서 백엔드 서버 구동 성공');
    } catch (err) {
        console.error('❌ 백엔드 서버 구동 실패:', err);
    }
}

function createWindow() {
    startBackendServer(); // 👈 창을 띄우기 전에 백엔드 서버를 먼저 실행합니다!

    const mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // 서버가 5000번 포트에 안착할 수 있도록 아주 짧은 딜레이(0.5초)를 준 뒤 로드하거나 바로 파일 로드
    setTimeout(() => {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }, 500);

    // 디버깅용 (필요시 주석 해제)
    //mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});