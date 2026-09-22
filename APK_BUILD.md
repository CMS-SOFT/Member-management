# 안드로이드 APK 빌드 가이드 (Capacitor)

court mate 웹앱을 안드로이드 APK로 빌드하는 방법입니다. 웹앱을 Capacitor로 감싸는 방식이라, **웹 화면/기능은 그대로** 유지됩니다.

## 이미 완료된 준비 (이 저장소에 반영됨)
- Capacitor 설치: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/filesystem`, `@capacitor/share`
- `capacitor.config.json` (appId `com.courtmate.app`, appName `court mate`, webDir `dist`)
- `android/` 네이티브 프로젝트 생성 완료
- CSV 내보내기: 모바일에서는 파일 저장 + 공유 시트로 동작하도록 분기 처리
- 모바일 뷰포트/터치 최적화 반영

## APK를 만들려면 필요한 것 (이 PC에 설치)
1. **JDK 17 또는 21** (Android Gradle Plugin이 요구하는 버전. JDK 25는 호환되지 않을 수 있음)
2. **Android Studio** (Android SDK, Platform-Tools 포함) — 가장 쉬움
   - Android Studio 설치 시 SDK가 함께 설치되고, `ANDROID_HOME` 환경변수가 잡힙니다.

> 참고: 개발 환경에 Android SDK가 없으면 아래 명령형 빌드는 실패합니다. 초보자는 **B안(Android Studio)**을 권장합니다.

## 방법 A — 명령어로 디버그 APK 빌드
프로젝트 루트에서:
```bash
npm run build           # 웹 빌드 (dist 생성)
npx cap sync android    # dist를 안드로이드 프로젝트로 복사 + 플러그인 반영
cd android
gradlew.bat assembleDebug   # (Windows) 디버그 APK 빌드
```
- 결과물: `android/app/build/outputs/apk/debug/app-debug.apk`
- 한 번에: 루트에서 `npm run apk:debug`

## 방법 B — Android Studio에서 빌드 (권장, 초보자용)
```bash
npm run build
npx cap sync android
npx cap open android     # Android Studio가 열립니다 (npm run cap:open)
```
Android Studio에서:
1. Gradle 동기화가 끝날 때까지 대기
2. 상단 메뉴 **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. 완료 팝업의 **locate**를 눌러 생성된 `app-debug.apk` 확인
4. 이 APK를 스마트폰에 복사해 설치(설정에서 '출처를 알 수 없는 앱 설치' 허용 필요)

## 웹 코드를 수정했을 때
웹(React) 코드를 고친 뒤에는 반드시 다시 반영해야 합니다:
```bash
npm run cap:sync   # = npm run build && npx cap sync android
```

## 배포용(릴리스) APK — 서명
릴리스 서명이 이미 gradle에 구성돼 있습니다(`android/app/build.gradle`). `android/keystore.properties`가 있으면 자동으로 릴리스 서명이 적용되고, 없으면 서명 없이 빌드됩니다.

1. **키스토어 생성** (android 폴더에서):
   ```bash
   keytool -genkey -v -keystore court-mate-release.keystore -alias courtmate -keyalg RSA -keysize 2048 -validity 10000
   ```
   (이름/조직/비밀번호를 입력. 비밀번호는 꼭 기억해두세요.)
2. **`android/keystore.properties` 작성** — `android/keystore.properties.example`을 복사해 값을 채웁니다:
   ```
   storeFile=court-mate-release.keystore
   storePassword=키스토어_비밀번호
   keyAlias=courtmate
   keyPassword=키_비밀번호
   ```
3. **릴리스 APK 빌드**:
   ```bash
   npm run build
   npx cap sync android
   cd android
   gradlew.bat assembleRelease
   ```
   - 결과물: `android/app/build/outputs/apk/release/app-release.apk`

> 보안: `keystore.properties`와 `*.keystore`는 `.gitignore`에 포함되어 커밋되지 않습니다. 키스토어 파일과 비밀번호는 안전하게 백업하세요. (분실 시 같은 앱으로 업데이트 배포 불가)
> 개인 사용/사이드로딩만 할 거면 디버그 APK로도 충분합니다.

## 설치 후 샘플 데이터 지우기
APK를 처음 설치하면 연습용 샘플 데이터가 들어 있습니다. 실제로 사용하려면:
- 앱에서 **정보 관리 ▾ → 데이터 초기화**를 누릅니다.
- 관리자 계정만 남고 회원·스케줄·이용권·샘플이 모두 삭제되며, 이후 앱을 다시 켜도 샘플이 재생성되지 않습니다.
- 그다음 정보 관리 → 가져오기(CSV)로 실제 데이터를 넣거나, 직접 회원/일정을 등록하면 됩니다.

## 검증 체크리스트 (실기기/에뮬레이터)
- [ ] 앱 실행 후 로그인 → 데이터(회원/스케줄/이용권)가 보이는지
- [ ] 스케줄 추가/수정/삭제 후 앱을 껐다 켜도 데이터가 **유지**되는지 (IndexedDB 영속성)
- [ ] 정보 관리 → 내보내기: 공유 시트가 뜨고 CSV를 저장/전송할 수 있는지
- [ ] 정보 관리 → 가져오기: 파일 선택 후 데이터가 반영되는지
- [ ] 팝업 드래그, 날짜 선택(date input), 버튼 터치가 매끄러운지
