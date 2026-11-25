# 씨앤씨 클래스룸

월별 출석부, 씨앤씨 캘린더, 학생 출결 검색, 진도표의 완성본입니다.
기존 Supabase를 그대로 사용하며 학생 명단과 출결·진도 기록은 이 저장소에 포함되지 않습니다.

## GitHub Pages 배포
1. GitHub에 공개 저장소를 만듭니다. 예: cnc-classroom
2. 이 폴더의 파일을 저장소 최상위에 올립니다. index.html이 바로 보여야 합니다.
3. Settings → Pages → Source에서 Deploy from a branch를 선택합니다.
4. Branch: main, 폴더: /(root)를 선택한 뒤 Save를 누릅니다.
5. 배포가 끝나면 Pages에 표시되는 주소로 접속합니다.

## 기존 DB 사용
프런트엔드에는 Supabase 프로젝트 URL과 publishable key가 포함되어 있습니다.
기존 DB 연결을 그대로 사용하므로 SQL 파일을 다시 실행할 필요가 없습니다.
service_role 키나 DB 비밀번호를 코드에 추가하지 마세요.

## 확인
- 서로 다른 기기에서 같은 출석·진도 기록을 확인합니다.
- 모바일에서 페이지를 새로고침하여 최신 스타일을 확인합니다.
- 기존 Sites 주소와 새 GitHub Pages 주소는 같은 DB를 사용합니다.

원본 Sites 버전: df8684f448173d5b45abc40d1661118d3fbf9eb6
