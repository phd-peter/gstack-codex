# Release Automation Deep Dive

이 문서는 `gstack-codex`에 이번에 적용한 upstream sync 자동화와 release 자동화의 구조를 자세히 설명한다.

대상 독자:

- 지금 이 저장소를 유지보수하는 maintainer
- 나중에 다시 와서 "어디까지 자동이고 어디부터 수동이지?"를 빠르게 복구해야 하는 사람
- 릴리스가 왜 이런 구조인지 이해해야 하는 사람

작성 기준일:

- `2026-04-23`

업데이트:

- `2026-05-04`: `auto-upstream-release.yml`을 추가해서 주간 upstream 확인에서
  patch version bump, npm publish, GitHub Release 생성까지 이어지는 자동 경로를
  만들었다. 기존 `sync-upstream.yml`은 수동 PR 검증용으로 남긴다.

## 1. 이번에 실제로 끝난 것

이번 작업으로 아래가 실제로 동작하는 상태가 되었다.

- upstream `garrytan/gstack` 변경 감지 자동화
- tracked upstream pin 기반의 재현 가능한 release build
- GitHub Actions 기반의 주간 upstream sync PR 생성
- GitHub Actions 기반의 npm publish 자동화
- GitHub Release asset 자동 업로드
- npm trusted publishing 기반의 토큰 없는 배포

그리고 실제로 이 구조를 이용해 배포까지 완료했다.

현재 확인된 상태:

- npm 최신 버전: `gstack-codex@0.2.0`
- GitHub Release: `v0.2.0`
- publish workflow: 성공
- publish source commit: `4b9a5981e8324a4d1dc71452d59705eb36d86eb4`
- tracked upstream pin:
  - version: `1.6.1.0`
  - commit: `656df0e37e67f8e6256d9e14d664a10b6db9c413`

## 2. 왜 이 구조로 바꿨는가

이전 문제는 간단했다.

release build가 사실상 로컬의 `.agents/skills/gstack`에 의존하고 있었다.

즉:

- 내 컴퓨터에서는 우연히 됨
- 깨끗한 CI checkout에서는 안 될 수 있음
- upstream를 정확히 어떤 commit 기준으로 감쌌는지 repo만 보고는 불명확함

이건 배포 구조로는 약하다.

그래서 구조를 아래처럼 분리했다.

1. upstream는 Git에서 pin 한다
2. release 시점에는 pin된 upstream를 CI에서 다시 bootstrap 한다
3. npm 배포는 pin된 upstream 기준으로 재생성한 artifact에서 만든다

이렇게 바꾸면:

- 릴리스가 재현 가능해진다
- 어떤 upstream를 감쌌는지 명확해진다
- 로컬 상태에 덜 의존한다
- sync와 publish를 분리할 수 있다

## 3. 핵심 개념

이 repo는 이제 두 층으로 생각하면 된다.

### Upstream layer

`garrytan/gstack`의 어느 버전과 어느 commit을 우리가 감쌀 것인가.

이 층의 소스 오브 트루스는:

- [`upstream-gstack.json`](upstream-gstack.json)

여기에 아래 정보가 들어간다.

- upstream repo URL
- branch
- generated host
- pinned upstream version
- pinned upstream commit

### Wrapper layer

그 upstream snapshot을 어떻게 `gstack-codex`라는 npm 패키지로 검증하고 배포할 것인가.

이 층의 관심사는:

- release build
- tests
- npm publish
- GitHub Release assets
- 버전 정책

중요한 점:

- upstream pin 변경과 npm package version bump는 같은 일이 아니다
- upstream를 올렸다고 항상 즉시 publish하는 것은 아니다
- wrapper만 수정해서 publish할 수도 있다

## 4. 새로 들어간 주요 파일

### `upstream-gstack.json`

tracked upstream pin 파일이다.

이제 "무슨 upstream를 감쌌는가?"라는 질문의 답은 이 파일 하나면 된다.

### `src/upstream-config.js`

pin 파일을 읽고 쓰는 공통 유틸이다.

역할:

- config 읽기
- config 정규화
- config 쓰기

### `src/upstream-bootstrap.js`

upstream bootstrap의 핵심 로직이다.

역할:

- upstream repo clone 또는 fetch
- pinned 또는 latest ref checkout
- upstream 내부 `.agents` 정리
- `bun install`
- `bun run gen:skill-docs --host codex`
- 최종 upstream version/commit 반환

즉, "CI에서 새 upstream checkout을 준비하는 핵심 엔진"이다.

### `src/upstream-source.js`

release build가 upstream source를 어디서 읽을지 결정한다.

핵심 포인트:

- 기본값은 로컬 `.agents/skills/gstack`
- CI에서는 `GSTACK_CODEX_UPSTREAM_ROOT` 환경변수 override 사용
- 준비되지 않은 checkout이면 에러로 막음

이 파일 덕분에 release build가 더 이상 로컬에만 묶이지 않는다.

### `scripts/bootstrap-upstream-gstack.mjs`

maintainer가 수동으로 upstream checkout을 bootstrap 할 때 쓰는 CLI entry다.

예:

```powershell
npm run bootstrap:upstream
```

### `scripts/sync-upstream.mjs`

최신 upstream commit을 확인하고, 변경이 있으면 bootstrapped checkout을 만든 뒤 pin 파일을 갱신하는 스크립트다.

예:

```powershell
npm run sync:upstream
```

### `.github/workflows/sync-upstream.yml`

주간 자동 감지용 workflow다.

역할:

- schedule로 upstream main 변경 감지
- pin 갱신
- 테스트
- release smoke build
- 자동 PR 생성

### `.github/workflows/publish.yml`

실제 배포 workflow다.

역할:

- tag push 또는 manual dispatch로 시작
- tag와 `package.json` version 일치 검증
- pinned upstream bootstrap
- 테스트
- release artifact 생성
- npm publish
- GitHub Release 생성 및 asset 업로드

## 5. 실제 데이터 흐름

현재 구조의 데이터 흐름은 아래와 같다.

### 흐름 A: upstream sync

1. `sync-upstream.yml`이 주간 실행된다
2. `scripts/sync-upstream.mjs`가 `git ls-remote`로 upstream 최신 commit을 본다
3. commit이 바뀌었으면 `dist/.sync-upstream/gstack`에 최신 upstream를 bootstrap 한다
4. `bun run gen:skill-docs --host codex`를 다시 돌린다
5. 그 결과를 보고 `upstream-gstack.json`을 새 version/commit으로 갱신한다
6. 테스트와 release smoke를 돌린다
7. 성공하면 PR을 자동으로 연다

여기서 중요한 점:

- 이 단계는 upstream의 generated tree를 repo에 대량 커밋하지 않는다
- repo에 남는 tracked change는 기본적으로 `upstream-gstack.json` 중심이다
- 실제 release artifact 생성은 publish 때 다시 수행한다

즉, 이 저장소는 "upstream 결과물 전체를 vendoring해서 보관하는 구조"가 아니라 "upstream ref를 pin하고 release 시점에 재생성하는 구조"다.

### 흐름 B: publish

1. maintainer가 배포할 커밋을 `main`에 올린다
2. maintainer가 `package.json` 버전을 올린다
3. maintainer가 `vX.Y.Z` 태그를 push 한다
4. `publish.yml`이 시작된다
5. `release` environment approval을 기다린다
6. 승인되면 pinned upstream를 `dist/.upstream/gstack`에 bootstrap 한다
7. `bun test`를 실행한다
8. release artifact를 만든다
9. npm tarball을 만든다
10. OIDC trusted publishing으로 npm publish 한다
11. GitHub Release를 만들고 asset를 올린다

## 6. 어디까지 자동이고 어디부터 수동인가

이 부분이 가장 중요하다.

## 6-1. 현재 자동인 것

- upstream 최신 commit 감지
- upstream bootstrap
- Codex용 artifact 재생성
- tests 실행
- release smoke 실행
- upstream pin 갱신
- `package.json` patch version bump
- release commit 생성
- `vX.Y.Z` tag 생성
- tag push 후 publish workflow 시작
- release build
- npm publish
- GitHub Release 생성
- release asset 업로드

즉:

- "감지"
- "검증"
- "배포 파이프라인 실행"

은 자동이다.

## 6-2. 현재 수동인 것

- `release` environment approval. 단, reviewer rule을 제거하면 이 단계도 자동이다.
- upstream change가 안전한지 판단. 완전 무인 운영에서는 CI smoke가 이 판단을 대신한다.
- wrapper 호환 수정이 필요한지 판단. 자동 workflow가 실패하면 사람이 개입한다.
- 수동 검증을 원할 때 `sync-upstream.yml`을 직접 실행하고 PR을 검토한다.

즉:

- "무엇을 shipping할지 결정하는 판단"
- "언제 release할지 결정하는 판단"

은 설정에 따라 사람의 역할로 남길 수도 있고, 무인으로 둘 수도 있다.

## 6-3. 그래서 질문에 대한 정확한 답

질문:

"이제 upstream에서 변경되면 자동으로 인식해서 코드치환해서 커밋푸쉬하면, 자동으로 배포까지 되는 건가?"

정확한 답:

2026-05-04 업데이트 이후에는 **가능하다**.

더 정확히 말하면:

- `auto-upstream-release.yml`이 upstream 변경을 자동 감지한다
- 변경이 있으면 upstream pin을 갱신한다
- wrapper patch version을 자동으로 올린다
- release commit과 tag를 자동 생성한다
- tests, release build, npm pack을 통과한 뒤 version tag를 push한다
- `publish.yml`을 dispatch 한다
- npm publish와 GitHub Release asset 업로드는 `publish.yml`이 처리한다
- `release` environment에 reviewer가 있으면 `publish.yml`이 승인 전까지 대기한다

즉 현재 구조는:

**자동 감지 + 자동 검증 + 승인형 자동 release**

에 가깝다.

reviewer rule을 제거하면 주간 upstream 확인에서 public publish까지 무인으로 이어진다.

## 7. 왜 release environment gate를 남겼는가

이건 의도적인 판단이다.

이 repo는 upstream wrapper다.
그래서 upstream가 바뀌었다고 무조건 바로 npm 최신 버전으로 풀어버리면 위험하다.

이유:

- upstream 변경이 wrapper contract를 깨뜨릴 수 있음
- install UX가 바뀔 수 있음
- generated skill docs 구조가 달라질 수 있음
- semver를 patch로 올릴지 minor로 올릴지 판단이 필요함
- 특정 upstream 변경은 일부러 hold 하고 싶을 수 있음

그래서 지금은 "workflow는 끝까지 자동으로 만들되, public publish 직전에 GitHub
environment로 멈출 수 있게 하자" 쪽이 더 안전하다.

## 8. 기술적으로 publish workflow가 하는 일

`publish.yml`의 핵심 로직은 아래다.

### 1. tag 해석

이 workflow는 두 가지로 시작된다.

- `push` tag: `v*`
- `workflow_dispatch`

그리고 실제 사용할 tag를 먼저 resolve한다.

### 2. tag와 package version 일치 검증

예를 들어:

- tag: `v0.2.0`
- `package.json` version: `0.2.0`

이 둘이 다르면 중간에 막는다.

즉 "틀린 태그로 잘못 publish"를 방지한다.

### 3. upstream bootstrap

release는 workspace에 이미 있던 `.agents/skills/gstack`를 믿지 않는다.

대신:

- `upstream-gstack.json`을 읽고
- pinned commit checkout
- `bun install`
- `gen:skill-docs --host codex`

를 다시 수행한다.

이게 핵심 재현성 포인트다.

### 4. test와 build

그 뒤:

- `bun test`
- release artifact 생성
- npm tarball 생성

을 수행한다.

### 5. npm trusted publishing

`NPM_TOKEN` 대신 GitHub Actions OIDC를 이용한다.

이 workflow는 그 요구사항에 맞게 구성했다.

- GitHub-hosted runner
- `id-token: write`
- Node `22.14.0+`
- npm `11.5.1+`

이 구조 덕분에 장기 수명 publish token을 repo secret으로 들고 있을 필요가 없다.

### 6. GitHub Release asset 업로드

publish 성공 후 아래 asset를 GitHub Release에 올린다.

- `gstack-codex-X.Y.Z.tgz`
- `release.json`
- `SHA256SUMS.txt`

즉 npm만 올라가는 것이 아니라, GitHub에서도 추적 가능한 release record가 남는다.

## 9. `release.json`과 `SHA256SUMS.txt`의 의미

이 둘은 단순 부가 파일이 아니다.

### `release.json`

이 파일은 release 메타데이터다.

포함 내용:

- package name
- package version
- created time
- upstream version
- upstream commit
- core/full skill count
- npm tarball path
- tarball size
- sha256

즉:

"이 npm release가 정확히 어떤 upstream snapshot에서 만들어졌는가?"

를 다시 복구할 수 있게 해준다.

### `SHA256SUMS.txt`

무결성 확인용이다.

즉:

- 다운로드한 asset가 release 시점과 같은지
- 배포 파일이 손상되거나 바뀌지 않았는지

를 확인할 수 있다.

## 10. 지금 구조에서 maintainer의 실제 운영 루틴

실제 maintainer 루틴은 아래처럼 이해하면 된다.

### 평소

- 아무것도 안 해도 됨
- `sync-upstream.yml`이 주간으로 upstream를 감지함

### upstream 변경 발생

- 자동 PR 생성
- maintainer가 PR 검토
- 필요하면 wrapper 수정
- merge 여부 결정

### 배포하고 싶을 때

1. `package.json` 버전 올림
2. 커밋
3. `vX.Y.Z` 태그 push
4. GitHub Actions에서 `release` environment 승인
5. 끝

즉 release는 지금 상당히 짧아졌다.

## 11. 현재 배포 예시

이번 배포는 실제로 아래 순서로 진행됐다.

1. upstream pin 시스템과 workflow를 repo에 추가
2. `package.json` version을 `0.2.0`으로 bump
3. commit 생성
4. `v0.2.0` tag push
5. `publish.yml` 실행
6. `release` environment 승인
7. npm publish 성공
8. GitHub Release `v0.2.0` 생성

현재 검증된 결과:

- npm: `gstack-codex@0.2.0`
- GitHub Release: `v0.2.0`
- publish workflow conclusion: `success`

## 12. 이 구조의 장점

- release가 재현 가능하다
- upstream provenance가 명확하다
- CI에서 clean build가 가능하다
- 로컬 `.agents` 상태에 덜 의존한다
- sync와 publish가 분리되어 운영이 안전하다
- npm token 없이 publish할 수 있다
- GitHub Release 자산까지 자동으로 남는다

## 13. 이 구조의 한계

이 구조는 자동 배포가 가능하지만, 일부 정책은 아직 단순하다.

현재 한계:

- upstream 변경은 항상 patch release로 취급한다
- upstream 변경 유형별 minor/major 자동 분류는 없다
- wrapper 호환 문제가 있으면 workflow 실패 후 사람이 고친다
- `release` environment reviewer rule을 켜면 승인 전까지 멈춘다
- `sync-upstream.yml`은 manual PR 검증 경로다. scheduled PR과 scheduled auto-release를 동시에 돌리지 않는다

즉 자동 CD는 가능하지만, semver 판단은 아직 보수적으로 patch에 고정되어 있다.

## 14. 더 똑똑한 자동 배포로 가고 싶다면 필요한 것

원하면 다음 단계로 확장할 수 있다.

가능한 확장:

- upstream 변경 유형에 따라 patch/minor 자동 분기
- upstream release note를 읽고 위험도를 분류
- install contract smoke test 확대
- wrapper 호환 실패 시 자동 issue 생성
- auto-release 실패 후 수동 `sync-upstream.yml` PR로 fallback

하지만 이걸 하려면 새 정책이 필요하다.

예:

- upstream pin bump는 항상 patch release인가
- smoke만 통과하면 바로 public publish 가능한가
- install contract 변경은 누가 막을 것인가

즉 기술적으로는 가능하지만, 운영 정책을 먼저 정해야 한다.

## 15. 결론

2026-05-04 업데이트 이후 `gstack-codex`는 다음 상태다.

- `auto-upstream-release.yml`이 주간으로 upstream 변경을 감지한다
- 또는 수동 `sync-upstream.yml` PR이 merge되어 `upstream-gstack.json`이 `main`에 들어오면 감지한다
- 변경이 있으면 upstream snapshot을 bootstrap 하고 검증한다
- `upstream-gstack.json`과 `package.json` patch version을 자동으로 갱신한다
- release commit과 `vX.Y.Z` tag를 자동으로 만든다
- `publish.yml`을 dispatch 한다
- npm publish와 GitHub Release asset 업로드는 `publish.yml`이 처리한다
- `release` environment에 reviewer가 있으면 `publish.yml`이 publish 전에 승인을 기다린다
- 기존 `sync-upstream.yml`은 수동 PR 검증 경로로 남아 있다

한 줄로 요약하면:

**현재는 "자동 감지 + 자동 검증 + 승인형 자동 배포" 구조다.**

GitHub `release` environment에 reviewer rule을 두면 승인형 자동 배포가 되고,
reviewer rule을 빼면 주간 upstream 확인에서 public publish까지 무인으로 이어진다.

## 16. 참고 파일

- [`upstream-gstack.json`](upstream-gstack.json)
- [`.github/workflows/sync-upstream.yml`](.github/workflows/sync-upstream.yml)
- [`.github/workflows/auto-upstream-release.yml`](.github/workflows/auto-upstream-release.yml)
- [`.github/workflows/publish.yml`](.github/workflows/publish.yml)
- [`src/upstream-bootstrap.js`](src/upstream-bootstrap.js)
- [`src/upstream-source.js`](src/upstream-source.js)
- [`scripts/bootstrap-upstream-gstack.mjs`](scripts/bootstrap-upstream-gstack.mjs)
- [`scripts/sync-upstream.mjs`](scripts/sync-upstream.mjs)
- [`MAINTAINER_RELEASE_FLOW.md`](MAINTAINER_RELEASE_FLOW.md)
- [`RELEASE_SETUP_CHECKLIST.md`](RELEASE_SETUP_CHECKLIST.md)
