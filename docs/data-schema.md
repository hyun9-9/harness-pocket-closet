# 데이터 스키마

DB 없음. AsyncStorage(JSON) + expo-file-system(이미지). 전부 로컬.

## 모델

```typescript
// 옷
interface Clothing {
  id: string              // uuid
  imageUri: string         // 로컬 파일 경로
  category: "상의" | "하의" | "아우터" | "원피스" | "신발" | "악세서리"
  colors: string[]         // ["검정", "흰색"]
  material: string         // "면"
  tags: string[]           // ["캐주얼", "미니멀"]
  createdAt: number        // timestamp
}

// 피팅 기록
interface FittingResult {
  id: string               // uuid
  resultImageUri: string   // 합성 이미지 로컬 경로
  clothingIds: string[]    // 사용된 옷 id
  createdAt: number
}

// 사용자
interface UserProfile {
  personImageUri: string | null  // 전신 사진 경로
}
```

## 저장 키

| AsyncStorage 키 | 타입 |
|-----------------|------|
| `@clothes` | Clothing[] |
| `@fittings` | FittingResult[] |
| `@userProfile` | UserProfile |

## 파일 구조

```
{documentDirectory}/
├── clothes/{id}.jpg       # 옷 (전부 JPG 변환)
├── fittings/{id}.jpg      # 합성 결과
└── person.jpg             # 전신 사진
```

## 정책

- **이미지**: 앱에서 1024px 리사이즈 + JPG 변환 후 저장
- **피팅 기록**: 제한 없음 (MVP)
- **옷 삭제 시**: 피팅 기록 유지, 삭제된 옷 썸네일은 placeholder 표시
- **추천 캐싱**: 없음 — 매번 새 요청
