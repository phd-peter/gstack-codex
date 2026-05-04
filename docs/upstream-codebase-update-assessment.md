# Upstream Codebase Update Assessment

Updated: 2026-05-04

## 내가 원하는 것

목표는 아래 흐름이다.

1. 매주 자동으로 원본 repo인 `garrytan/gstack`을 확인한다.
2. upstream에 새 내용이 있으면 이 repo가 그 내용을 받아온다.
3. 받아온 내용이 `gstack-codex`의 코드베이스와 배포물에 반영된다.
4. 테스트와 release build를 통과한다.
5. npm publish와 GitHub Release까지 이어진다.

핵심 질문은 배포 자체보다 이것이다.

> upstream 내용이 이 repo에 얼마나 제대로 반영되는가?

즉, 단순히 `package.json` 버전만 올리는 자동화는 목표가 아니다.
upstream의 실제 skill/runtime 내용이 사용자에게 설치되는 package에 들어가야 한다.

## 현재 코드에 구현된 것

현재 구현은 "upstream 전체 파일을 `main`에 커밋하는 방식"이 아니다.

현재 구현은 "upstream pin을 `main`에 기록하고, release build 시점에 그 pin에서 bundle을 다시 만드는 방식"이다.

### 1. 주간 자동 확인

파일:

- `.github/workflows/auto-upstream-release.yml`

동작:

- 매주 월요일 03:17 UTC에 실행된다.
- 한국 시간으로는 월요일 12:17 KST다.
- `garrytan/gstack@main`의 최신 commit을 확인한다.
- 현재 `upstream-gstack.json`의 `pinned_commit`과 비교한다.

현재 pin:

- upstream version: `1.6.1.0`
- upstream commit: `656df0e37e67f8e6256d9e14d664a10b6db9c413`

### 2. upstream pin 업데이트

파일:

- `upstream-gstack.json`
- `scripts/sync-upstream.mjs`

upstream commit이 바뀌면 `upstream-gstack.json`이 새 commit/version으로 갱신된다.

`main`에 남는 핵심 변경은 이것이다.

- `upstream-gstack.json`
- `package.json` patch version bump

### 3. release artifact 생성

파일:

- `scripts/bootstrap-upstream-gstack.mjs`
- `scripts/build-release-artifacts.mjs`
- `scripts/pack-release.mjs`
- `src/release-artifacts.js`

release workflow는 `upstream-gstack.json`의 pin을 보고 upstream repo를 다시 준비한다.
그 다음 release bundle을 만든다.

생성되는 내용:

- `dist/releases/<version>/bundle`
- `bundle/current`
- `dist/releases/<version>/release.json`
- `dist/releases/<version>/SHA256SUMS.txt`
- `dist/releases/<version>/npm/gstack-codex-<version>.tgz`

중요한 점:

- `bundle/current`는 `.gitignore`에 들어있다.
- 그래서 generated bundle은 `main`에 커밋되지 않는다.
- 대신 npm package 안에는 `bundle/current`가 포함된다.

`package.json`의 `files`에도 `bundle/current`가 포함되어 있다.

### 4. 배포

파일:

- `.github/workflows/publish.yml`

`publish.yml`만 npm trusted publisher다.

이유:

- npm은 package당 trusted publisher를 하나만 허용한다.
- 그래서 `auto-upstream-release.yml`이 직접 `npm publish`를 하면 안 된다.
- `auto-upstream-release.yml`은 release commit과 tag를 만들고, `publish.yml`을 `workflow_dispatch`로 호출한다.

왜 dispatch가 필요한가:

- GitHub Actions의 기본 `GITHUB_TOKEN`으로 push한 tag는 새 `push` workflow를 실행하지 않는다.
- `workflow_dispatch`는 예외적으로 허용된다.
- 그래서 tag push만 믿지 않고 `publish.yml`을 명시적으로 실행한다.

## 현재 상태

현재 구현은 아래까지 된다.

| 항목 | 상태 | 판단 |
|---|---:|---|
| 주간 upstream 확인 | 구현됨 | OK |
| upstream commit/version pin 갱신 | 구현됨 | OK |
| wrapper package patch version bump | 구현됨 | OK |
| test 실행 | 구현됨 | OK |
| release bundle build | 구현됨 | OK |
| npm tarball pack | 구현됨 | OK |
| upstream 변경 요약 report | 구현됨 | OK |
| wrapper compatibility gate | 구현됨 | OK |
| npm publish | `publish.yml`에서 구현됨 | 외부 설정 필요 |
| GitHub Release asset upload | 구현됨 | OK |
| review-first upstream PR | 수동 workflow로 구현됨 | OK |
| upstream 전체 generated 파일을 `main`에 커밋 | 구현 안 됨 | 의도된 설계 |
| upstream 변경에 맞춰 wrapper source code를 자동 수정 | 구현 안 됨 | 현재 가장 큰 한계 |

검증한 내용:

- `bun test`: 19 passed
- workflow YAML parse: 통과
- `git diff --check`: 통과
- `npm run bootstrap:upstream`: 통과
- `npm run build:release`: 통과
- `npm run pack:release`: 통과
- `npm run check:release`: 통과하도록 workflow에 추가됨
- npm tarball 내부에 `bundle/current` 포함 확인

tarball 안에서 확인된 예:

- `package/bundle/current/manifest.json`
- `package/bundle/current/packs/core/skills/gstack-ship/SKILL.md`
- `package/bundle/current/packs/full/skills/gstack-autoplan/SKILL.md`

## 코드베이스 업데이트가 얼마나 잘 되는가

여기서 "코드베이스 업데이트"를 두 가지로 나눠야 한다.

### A. upstream skill/runtime 내용을 package에 반영하는 것

현재 상태: 잘 된다.

점수: 8/10

이유:

- upstream commit을 정확히 pin한다.
- release build에서 그 pin을 기준으로 bundle을 만든다.
- npm tarball 안에 `bundle/current`가 들어간다.
- `release.json`에 upstream version/commit과 skill count가 기록된다.

남은 리스크:

- upstream의 생성물 구조가 크게 바뀌면 build가 실패할 수 있다.
- 이 경우 자동 수정은 하지 않고 workflow가 실패한다.

### B. upstream 변화에 맞춰 이 repo의 wrapper source code를 자동 수정하는 것

현재 상태: 거의 안 된다.

점수: 2/10

이유:

- 현재 자동화는 `src/`, `bin/`, installer logic 같은 wrapper source를 AI나 merge logic으로 고치지 않는다.
- upstream 변화가 wrapper 코드 수정을 요구하면, 테스트나 build에서 실패할 수는 있다.
- 하지만 실패 후 자동으로 코드를 고치고 PR을 만드는 단계는 없다.

예:

- upstream의 skill directory 구조가 바뀜
- generated host output 위치가 바뀜
- manifest schema가 바뀜
- setup 방식이 바뀜

이런 경우 현재 자동화는 감지하거나 실패할 수는 있지만, wrapper code를 고치지는 않는다.

### C. 사람이 merge 전에 검토할 수 있는 정도

현재 상태: 좋음.

점수: 8/10

이유:

- `sync-upstream.yml`을 수동 실행하면 PR이 열린다.
- PR 본문에 previous/next upstream version, commit, compare link가 들어간다.
- PR 생성 전에 tests, release build, npm pack smoke를 수행한다.
- PR 생성 전에 release compatibility gate를 수행한다.
- upstream diff report가 workflow artifact로 첨부된다.

부족한 점:

- wrapper source code 수정이 필요한 경우 자동 수정 PR을 만들지는 않는다.

## 지금 구조의 정확한 의미

현재 구조에서 `main`에 merge되는 것은 upstream 전체 내용이 아니다.

`main`에 merge되는 것은 아래다.

- "우리가 이제 어떤 upstream commit을 기준으로 삼는가"
- "그 기준으로 새 wrapper version을 배포한다"

실제 upstream 내용은 배포 package 안에 들어간다.

이 구조는 나쁘지 않다.
오히려 generated bundle을 repo에 매번 커밋하지 않아서 diff가 작고, provenance가 명확하다.

하지만 사용자가 말한 "코드베이스 업데이트"가 wrapper source code의 자동 수정을 포함한다면, 현재 구현은 아직 부족하다.

## 원하는 목표에 더 가까워지려면

### 1단계. 현재 구조 유지

이건 이미 되어 있다.

- upstream pin update
- release build
- npm tarball 생성
- publish dispatch

이 단계는 "upstream content를 package에 반영"하는 목표를 만족한다.

### 2단계. upstream 변경 요약 report 추가

구현됨.

추가된 것:

- `scripts/report-upstream-diff.mjs`
- `src/upstream-diff-report.js`
- `test/upstream-diff-report.test.ts`
- `sync-upstream.yml` PR body에 commit/file/category summary 표시
- `sync-upstream.yml` workflow artifact로 `upstream-diff-report` 업로드
- `auto-upstream-release.yml` workflow artifact로 release별 upstream diff report 업로드
- `publish.yml` GitHub Release asset으로 `upstream-diff-report.md` 업로드

이 단계가 있으면 maintainer가 "무슨 내용이 들어왔는지" 바로 볼 수 있다.

남은 개선:

- skill별 added/removed/changed를 더 정교하게 계산할 수 있다.
- 지금은 upstream git file path 기준 category summary가 중심이다.

### 3단계. wrapper compatibility gate 추가

구현됨.

추가된 것:

- `scripts/check-release-compatibility.mjs`
- `src/release-compatibility.js`
- `test/release-compatibility.test.ts`
- `npm run check:release`
- `sync-upstream.yml`, `auto-upstream-release.yml`, `publish.yml`에서 release build/pack 이후 gate 실행

검사하는 것:

- `bundle/current/manifest.json` 존재
- bundle schema version
- core pack 필수 skill 존재
- full pack skill file 존재
- runtime `SKILL.md` 존재
- `release.json`의 upstream commit과 skill count가 bundle manifest와 일치
- npm tarball 안에 `bundle/current` 핵심 파일이 포함되어 있는지 확인

남은 개선:

- 실제 `gstack-codex init --global`/`init --project`를 tarball 설치 후 실행하는 end-to-end test는 아직 없다.

### 4단계. 자동 wrapper code update PR

이건 아직 구현되어 있지 않다.

가능한 방식:

1. 주간 workflow가 upstream change를 감지한다.
2. tests/build/pack이 실패하면 release를 중단한다.
3. 별도 workflow 또는 AI agent가 실패 로그와 upstream diff를 읽는다.
4. wrapper source code 수정 PR을 만든다.
5. 사람이 review 후 merge한다.
6. merge 후 자동 release가 다시 돈다.

이 단계가 있어야 "upstream 변화에 맞춰 코드베이스 자체가 자동 적응한다"에 가까워진다.

단, 완전 무인으로 wrapper code까지 고치는 것은 위험하다.
설치 도구는 사용자 홈 디렉터리와 repo 파일을 건드린다.
자동 수정은 PR까지가 적절하고, publish는 테스트와 reviewer gate 뒤에 두는 편이 맞다.

## 결론

현재 구현은 사용자의 목표 중 절반 이상을 만족한다.

되는 것:

- 주간 upstream 확인
- upstream pin 갱신
- package version bump
- upstream bundle 생성
- npm package에 upstream 내용 포함
- publish까지 연결

아직 안 되는 것:

- upstream 변경 내용의 상세 요약
- wrapper source code의 자동 적응
- 실패 시 자동 수정 PR 생성

따라서 정확한 현재 평가는 이렇다.

> "upstream 내용을 package에 반영해서 배포"는 구현되어 있다.
> "upstream 변화에 맞춰 코드베이스 source가 자동으로 고쳐지는 것"은 아직 구현되어 있지 않다.

다음으로 해야 할 일은 version bump가 아니라, 실패 시 wrapper source code 수정 PR을 자동으로 만드는 안전한 repair path를 추가하는 것이다.
