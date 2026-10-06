import { textWhere } from './reference-helpers';

describe('textWhere (?q= on reference lists)', () => {
  it('filters nothing without text', () => {
    expect(textWhere(undefined, ['code'])).toEqual({});
    expect(textWhere('   ', ['code'])).toEqual({});
  });

  it('matches any field, case-insensitively, on the trimmed text', () => {
    expect(textWhere('  lab ', ['code', 'nameTh'])).toEqual({
      OR: [
        { code: { contains: 'lab', mode: 'insensitive' } },
        { nameTh: { contains: 'lab', mode: 'insensitive' } },
      ],
    });
  });
});
