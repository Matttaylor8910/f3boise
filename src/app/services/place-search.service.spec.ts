import {isDistinctPlaceName, parseAddressComponents} from './place-search.service';

describe('parseAddressComponents', () => {
  it('assembles street from number + route and picks locality/state/zip', () => {
    const parsed = parseAddressComponents([
      {long_name: '4700', short_name: '4700', types: ['street_number']},
      {long_name: 'Skyway Street', short_name: 'Skyway St', types: ['route']},
      {
        long_name: 'Caldwell',
        short_name: 'Caldwell',
        types: ['locality', 'political']
      },
      {
        long_name: 'Idaho',
        short_name: 'ID',
        types: ['administrative_area_level_1', 'political']
      },
      {long_name: '83605', short_name: '83605', types: ['postal_code']},
    ]);
    expect(parsed).toEqual({
      street: '4700 Skyway Street',
      city: 'Caldwell',
      state: 'ID',
      zip: '83605',
    });
  });

  it('falls back through city aliases when locality is absent', () => {
    const parsed = parseAddressComponents([
      {long_name: 'Ada County', short_name: 'Ada', types: ['sublocality']},
    ]);
    expect(parsed.city).toBe('Ada County');
  });

  it('handles POIs with no street number and missing fields', () => {
    const parsed = parseAddressComponents([
      {long_name: 'Marjorie Avenue', short_name: 'Marjorie Ave', types: ['route']},
    ]);
    expect(parsed).toEqual(
        {street: 'Marjorie Avenue', city: '', state: '', zip: ''});
  });

  it('returns empty fields for undefined components', () => {
    expect(parseAddressComponents(undefined))
        .toEqual({street: '', city: '', state: '', zip: ''});
  });
});

describe('isDistinctPlaceName', () => {
  it('keeps a POI name absent from the address', () => {
    expect(isDistinctPlaceName(
               'Pipe Dream Park', '4700 Skyway St, Caldwell, ID 83605, USA'))
        .toBeTrue();
  });

  it('drops a name that just echoes the address', () => {
    expect(isDistinctPlaceName(
               '4700 Skyway St', '4700 Skyway St, Caldwell, ID 83605, USA'))
        .toBeFalse();
  });

  it('drops empty names', () => {
    expect(isDistinctPlaceName('  ', 'anywhere')).toBeFalse();
  });
});
