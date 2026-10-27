import { describe, expect, it } from 'vitest';

import { md5 } from './md5';

describe('md5', () => {
  it.each([
    // RFC 1321, appendix A.5.
    ['', 'd41d8cd98f00b204e9800998ecf8427e'],
    ['a', '0cc175b9c0f1b6a831c399e269772661'],
    ['abc', '900150983cd24fb0d6963f7d28e17f72'],
    ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
    ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
    [
      '12345678901234567890123456789012345678901234567890123456789012345678901234567890',
      '57edf4a22be3c955ac49da2e2107b67a',
    ],
    // What Postgres's md5() gave on the project's database for the same text.
    ['Imperiais à Invicta ⚽', '02f4a892442017cdd04046e39c42e271'],
    [
      '3f1c2a9e-0000-4000-8000-0000000000a1e5000000-0000-4000-8000-000000000001',
      '04abdd78573b7d03e5bcd3242f2a4f85',
    ],
  ])('md5(%j) = %s', (texto, esperado) => {
    expect(md5(texto)).toBe(esperado);
  });

  // Lengths around the 64-byte blocks, where the padding changes (digests from Python's hashlib).
  it.each([
    [1, '9dd4e461268c8034f5c8564e155c67a6'],
    [54, '61ea0974c662328da964d977a8253873'],
    [55, '04364420e25c512fd958a70738aa8f72'],
    [56, '668a72d5ba17f08e62dabcafad6db14b'],
    [57, '693037871c4a9d3d8685018905cb530a'],
    [63, '7dc2ca208106a2f703567bdff99d8981'],
    [64, 'c1bb4f81d892b2d57947682aeb252456'],
    [65, '1bc932052302d074bdec39795fe00cf6'],
    [119, 'ab347a5f68c8a443cfcddc633f12c24f'],
    [120, 'fb98667f98096de92620b64f46e1c5b5'],
    [121, 'e8bb0ccd83750100b37f4831cd5d7ee2'],
    [127, 'a0b28c1da68705c2ff883fe279b72753'],
    [128, 'd69cb61a6ee87200676eb0d4b90edbcb'],
    [129, '3926841d393c00c3f36260e5ace10dc1'],
    [200, '30a83621ce5422fbdfdd539777458c78'],
  ])('%s vezes «x»', (tamanho, esperado) => {
    expect(md5('x'.repeat(tamanho))).toBe(esperado);
  });

  // Two uuids glued together, as trip_balances hashes an expense and a person (digests from Python's hashlib).
  it.each([
    ['6513270e-269e-4d37-b2a7-4de452e6b438d23f0824-128b-4f33-8c5c-7fd0a6a3a450', '8184727984913c958a34be30f9810743'],
    ['9531985d-5d9d-49f8-9818-e811892f902b36f675cc-81e7-4ef5-a8e2-5d940ed90475', '6d86c4dcbe703ea4cd0fb089f83992cc'],
    ['6b0d549b-6f03-475a-9600-a35a099950d88d116ece-1738-47d9-bd9c-172411e20b8f', '95acd15584e1a2c80bca931a12f544bc'],
    ['90c192cf-d3ac-44af-8f21-ddb66cad4a26a170b338-3926-4059-b28c-105d1fb17c23', 'f9f1db8b0fdcda3ff6e7e119786d5066'],
    ['0fd630f1-f29d-4da9-953f-48f1a09f76b50cb1e29c-658c-4a14-95e6-0af593bd04cf', 'f8c0fafeb83417bc0210ad9e543f3cff'],
    ['8e81973e-0bec-47b0-b898-d190f9ebdacc6b4cb242-4a23-4596-a217-beaddbc496cb', 'cbcfdc089ffa316afeeeb95b5ba5f2aa'],
  ])('md5(%s)', (texto, esperado) => {
    expect(md5(texto)).toBe(esperado);
  });
});
