import { toggleWithRules } from '../components/SelectableClothingGrid';
import type { Category, Clothing } from '../types';

const make = (id: string, category: Category): Clothing => ({
  id,
  imageUri: `file:///${id}.jpg`,
  category,
  colors: [],
  material: '',
  tags: [],
  createdAt: 0,
});

const clothes: Clothing[] = [
  make('top1', '상의'),
  make('top2', '상의'),
  make('bottom1', '하의'),
  make('bottom2', '하의'),
  make('outer1', '아우터'),
  make('dress1', '원피스'),
  make('dress2', '원피스'),
  make('shoes1', '신발'),
  make('acc1', '악세사리'),
];

describe('toggleWithRules', () => {
  it('기존 선택이 없을 때 단순 추가', () => {
    expect(toggleWithRules(clothes, [], 'top1')).toEqual(['top1']);
  });

  it('이미 선택된 id 를 다시 누르면 해제', () => {
    expect(toggleWithRules(clothes, ['top1', 'bottom1'], 'top1')).toEqual(['bottom1']);
  });

  it('같은 카테고리에서 기존 선택을 대체(침묵 스와핑)', () => {
    const next = toggleWithRules(clothes, ['top1', 'bottom1'], 'top2');
    expect(next).toEqual(['bottom1', 'top2']);
  });

  it('원피스 선택 시 상의·하의가 해제된다', () => {
    const next = toggleWithRules(clothes, ['top1', 'bottom1', 'outer1', 'shoes1'], 'dress1');
    expect(next).toEqual(['outer1', 'shoes1', 'dress1']);
  });

  it('상의 선택 시 원피스가 해제된다', () => {
    const next = toggleWithRules(clothes, ['dress1', 'shoes1'], 'top1');
    expect(next).toEqual(['shoes1', 'top1']);
  });

  it('하의 선택 시 원피스가 해제된다', () => {
    const next = toggleWithRules(clothes, ['dress1'], 'bottom1');
    expect(next).toEqual(['bottom1']);
  });

  it('원피스끼리도 최대 1개(스와핑)', () => {
    expect(toggleWithRules(clothes, ['dress1'], 'dress2')).toEqual(['dress2']);
  });

  it('아우터/신발/악세사리는 독립적으로 공존 가능', () => {
    let sel: string[] = [];
    sel = toggleWithRules(clothes, sel, 'outer1');
    sel = toggleWithRules(clothes, sel, 'shoes1');
    sel = toggleWithRules(clothes, sel, 'acc1');
    expect(sel.sort()).toEqual(['acc1', 'outer1', 'shoes1']);
  });

  it('존재하지 않는 id 는 무시', () => {
    expect(toggleWithRules(clothes, ['top1'], 'ghost')).toEqual(['top1']);
  });

  it('규칙 위반 상태가 나올 수 없음(카테고리별 최대 1개, 원피스↔상/하 상호 배타)', () => {
    // 시나리오: 상의, 하의, 아우터, 신발, 악세사리, 다른 상의, 원피스, 다른 원피스 순차 탭
    const sequence = ['top1', 'bottom1', 'outer1', 'shoes1', 'acc1', 'top2', 'dress1', 'dress2'];
    let sel: string[] = [];
    for (const id of sequence) {
      sel = toggleWithRules(clothes, sel, id);
      const cats = sel.map((sid) => clothes.find((c) => c.id === sid)!.category);
      // 카테고리별 최대 1개
      const counts = new Map<Category, number>();
      cats.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));
      counts.forEach((n) => expect(n).toBeLessThanOrEqual(1));
      // 원피스와 상/하 공존 금지
      const hasDress = cats.includes('원피스');
      const hasTop = cats.includes('상의');
      const hasBottom = cats.includes('하의');
      expect(hasDress && (hasTop || hasBottom)).toBe(false);
    }
  });
});
