# Court Mate APK를 PC에서 검증하기

이 안내는 Android 에뮬레이터에서 APK를 실행하고, PC의 API 서버에 연결해 기본 기능을 확인하는 절차입니다.

## 현재 APK의 동작 방식

- APK는 `member_management.db`를 포함하거나 휴대폰 로컬 DB를 사용하지 않습니다.
- 앱은 `http://localhost:5000/api`에 요청합니다. 에뮬레이터의 `adb reverse` 기능으로 이 요청을 PC 서버에 연결합니다.
- 서버 데이터베이스는 테스트용 복사본으로 지정합니다. 원본 `server/member_management.db`를 보호하기 위해서입니다.
- Android 네트워크 설정은 HTTP를 기본 차단하고, `localhost`만 허용합니다.

## 1. Android 에뮬레이터 준비

Android Studio가 설치되어 있지 않다면 Android Studio를 설치한 뒤 실행합니다. SDK Manager의 Android SDK Location은 다음 경로로 지정합니다.

```text
%LOCALAPPDATA%\CourtMateAndroidBuild\android-sdk
```

1. **Tools → SDK Manager → SDK Tools**에서 **Android Emulator**를 설치합니다.
2. **More Actions → Virtual Device Manager**(또는 **Tools → Device Manager**)를 엽니다.
3. **Create Virtual Device**를 눌러 Pixel 기기를 선택합니다.
4. API 35 이상의 시스템 이미지를 내려받아 에뮬레이터를 만듭니다.
5. 에뮬레이터를 시작합니다.

실제 Android 휴대폰을 USB 디버깅으로 연결해도 같은 절차를 사용할 수 있습니다.

## 2. 테스트용 DB로 PC 서버 실행

프로젝트 루트에서 PowerShell 창을 열고 테스트 DB 복사본을 만든 뒤 서버를 실행합니다.

```powershell
$testDb = Join-Path $env:TEMP 'court-mate-apk-test.db'
Copy-Item '.\server\member_management.db' $testDb -Force
$env:MEMBER_MANAGEMENT_DB_PATH = $testDb
node .\server\server.cjs
```

서버가 `http://localhost:5000`에서 시작됐다는 메시지가 나오면 이 PowerShell 창을 열어 둡니다. 테스트 중 데이터 추가·수정·삭제는 `$testDb` 복사본에만 반영됩니다.

별도 PowerShell 창에서 PC 서버 응답을 확인합니다.

```powershell
Invoke-RestMethod 'http://localhost:5000/api/bootstrap'
```

오류 없이 데이터가 반환되어야 합니다.

## 3. APK 설치 및 PC 서버 연결

Android Studio의 에뮬레이터를 실행한 다음, 프로젝트 루트의 새 PowerShell 창에서 실행합니다.

```powershell
$sdk = Join-Path $env:LOCALAPPDATA 'CourtMateAndroidBuild\android-sdk'
$adb = Join-Path $sdk 'platform-tools\adb.exe'
$apk = '.\android\app\build\outputs\apk\debug\app-debug.apk'

& $adb devices
& $adb reverse tcp:5000 tcp:5000
& $adb install -r $apk
& $adb shell monkey -p com.courtmate.app 1
```

`adb devices` 결과에 실행 중인 에뮬레이터가 `device` 상태로 보여야 합니다. `adb reverse`는 에뮬레이터의 `localhost:5000` 요청을 PC의 `localhost:5000`으로 연결합니다.

## 4. 기본 확인 항목

- 앱이 실행되고 초기 데이터가 표시되는지 확인합니다.
- 테스트용 회원을 등록하거나 기존 테스트 데이터를 수정합니다.
- 앱을 닫았다 다시 열어 변경 결과가 유지되는지 확인합니다.
- 서버를 종료한 상태에서 데이터 연결 오류가 표시되는지 확인한 뒤, 서버를 다시 켜서 정상 복구되는지 확인합니다.
- CSV 내보내기 등 파일 공유 기능을 확인합니다.

앱이 서버에 연결되지 않으면 서버 창이 실행 중인지, `Invoke-RestMethod`가 성공하는지, `adb reverse tcp:5000 tcp:5000`을 다시 실행했는지 확인합니다.

## 5. APK 다시 빌드하기

이 PC의 JDK와 Android SDK 경로를 현재 PowerShell 창에 설정한 뒤 빌드합니다.

```powershell
$buildTools = Join-Path $env:LOCALAPPDATA 'CourtMateAndroidBuild'
$env:JAVA_HOME = Join-Path $buildTools 'jdk21\jdk-21.0.13.0.2+1'
$env:ANDROID_HOME = Join-Path $buildTools 'android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

npm run apk:debug
```

빌드 결과:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

## 종료 및 데이터 정리

- API 서버 창에서 `Ctrl+C`를 눌러 서버를 종료합니다.
- 테스트 DB는 `%TEMP%\court-mate-apk-test.db`에 남습니다. 다시 테스트할 때 원본 DB를 복사해 덮어쓰면 초기 상태로 돌아갑니다.
- 에뮬레이터와 USB 연결을 해제해도 PC 원본 DB에는 영향을 주지 않습니다.

> 이 APK는 PC 서버 연동을 검증하기 위한 디버그 빌드입니다. 휴대폰 단독 사용을 검증하는 APK가 아닙니다.
