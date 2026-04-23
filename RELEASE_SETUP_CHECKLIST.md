# Release Setup Checklist

이 문서는 `gstack-codex`의 실제 배포를 시작하기 전에, maintainer가 직접 UI에서 설정해야 하는 두 가지를 정리한다.

이 두 단계는 코드 작업이 아니라 계정/리포 설정이다. 따라서 아래 권한이 있는 사람이 직접 해야 한다.

- npm: `gstack-codex` 패키지 maintainer 권한
- GitHub: `phd-peter/gstack-codex` 저장소 admin 권한

코드 쪽 준비는 이미 되어 있다.

- workflow 파일: `.github/workflows/publish.yml`
- 운영 문서: `MAINTAINER_RELEASE_FLOW.md`

현재 `publish.yml`은 npm trusted publishing 요구사항에 맞춰져 있다.

- GitHub-hosted runner 사용
- `id-token: write` 권한 포함
- Node `22.14.0+`
- npm `11.5.1+`

## 1. npm trusted publisher 등록

목적:
GitHub Actions가 `NPM_TOKEN` 없이 OIDC로 `npm publish` 하도록 만든다.

입력해야 할 값:

- Organization or user: `phd-peter`
- Repository: `gstack-codex`
- Workflow filename: `publish.yml`
- Environment name: `release`

실제 클릭 순서:

1. `npmjs.com`에 로그인한다.
2. `Packages`로 이동한다.
3. `gstack-codex` 패키지를 연다.
4. `Settings`로 이동한다.
5. `Trusted publishing` 섹션을 찾는다.
6. `GitHub Actions`를 선택한다.
7. 위 값을 그대로 입력한다.
8. 저장한다.

주의:

- `Workflow filename`에는 `.github/workflows/publish.yml` 전체 경로를 넣지 말고 `publish.yml`만 넣는다.
- 값이 틀려도 저장은 될 수 있고, 실제 publish 시점에만 실패할 수 있다.
- trusted publishing은 현재 GitHub-hosted runner 기준이다. 이 repo의 workflow는 그 조건에 맞춰져 있다.
- `NPM_TOKEN` secret은 필요 없다.

권장 후속 조치:

첫 번째 OIDC publish가 성공한 뒤에 아래를 적용하는 것을 권장한다.

1. `npmjs.com`의 같은 패키지 설정 페이지에서 `Publishing access`로 이동한다.
2. `Require two-factor authentication and disallow tokens`를 선택한다.
3. 저장한다.

바로 잠그기보다, trusted publishing이 실제로 한 번 성공한 뒤 바꾸는 편이 안전하다.

## 2. GitHub release environment 생성

목적:
`publish.yml` 실행 전에 승인 게이트를 둘 수 있게 만든다.

실제 클릭 순서:

1. GitHub에서 `phd-peter/gstack-codex` 저장소로 이동한다.
2. `Settings`로 이동한다.
3. 왼쪽 메뉴에서 `Environments`를 연다.
4. `New environment`를 누른다.
5. 이름에 `release`를 입력하고 생성한다.

권장 설정:

- Required reviewers: 1명 또는 1팀
- Prevent self-review: 필요하면 체크
- Deployment branches and tags: `Selected branches and tags`
- Ref type: `Tag`
- Pattern: `v*`

왜 필요한가:

- `publish.yml`은 `environment: release`를 사용한다.
- 환경을 미리 만들지 않아도 첫 실행 시 GitHub가 자동 생성할 수는 있다.
- 하지만 자동 생성된 환경은 protection rule이 없을 수 있다.
- 즉, 승인 없이 바로 publish가 진행될 수 있다.

정리하면:

- 환경 생성 자체는 사실상 필수에 가깝다.
- reviewer rule은 선택이지만, 운영 안전성을 위해 권장한다.

## 3. 설정이 끝난 뒤 실제 배포

일반적인 흐름은 아래와 같다.

1. `package.json` 버전을 올린다.
2. 커밋한다.
3. 태그를 만든다. 예: `v0.1.2`
4. 태그를 origin에 push 한다.
5. GitHub Actions에서 `publish.yml`이 실행된다.
6. `release` environment에 reviewer를 걸어뒀다면 승인 후 publish가 진행된다.

예시:

```powershell
git tag v0.1.2
git push origin v0.1.2
```

## 4. 문제 생기면 먼저 볼 것

- npm trusted publisher의 `Workflow filename`이 정확히 `publish.yml`인지
- npm trusted publisher의 `Environment name`이 `release`인지
- GitHub repo에 `release` environment가 실제로 있는지
- Actions runner가 self-hosted가 아닌 GitHub-hosted인지
- workflow에 `id-token: write` 권한이 있는지
- publish tag가 `package.json` 버전과 일치하는지

## 5. 공식 문서

- npm trusted publishers: https://docs.npmjs.com/trusted-publishers/
- GitHub environments 생성: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments
- GitHub deployments/environments 개념: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments
