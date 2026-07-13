# 그로우미 (GrowMe)

자기계발(공부·독서·운동 등)을 타이머로 몰입 인증하면, 쌓인 시간만큼 캐릭터 "꾸미"가 성장하는 웹 서비스입니다. 미루면 꾸미가 정체되거나 퇴화합니다.

## 핵심 컨셉

체크박스가 아니라 타이머로 몰입한 실제 시간만 기록됩니다. 인증된 시간이 쌓이면 꾸미가 성장하고, 활동이 없으면 정체·퇴화합니다. 카테고리(운동/학업/독서/기타)별 비중으로 꾸미의 외형이, 전체 누적 인증시간으로 성장 단계(크기)가 결정됩니다.

## 스택

프론트엔드는 React(PWA), 백엔드는 Node.js + Express, DB는 PostgreSQL(Prisma)입니다.

## 실행

```
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

백엔드는 로컬 PostgreSQL(`DATABASE_URL`)이 필요합니다. `.env.example` 참고.

## 상태

MVP 기능 구현 완료 (인증, 활동, 타이머 세션, 꾸미 성장/퇴화, 히스토리, PWA). 스타일링은 아직 진행 전.
