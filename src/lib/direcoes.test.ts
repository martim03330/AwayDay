import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Linking: { openURL: async () => undefined }, Platform: { OS: 'ios' } }));

const { urlDirecoes, urlDoCaminho } = await import('@/lib/direcoes');

const coimbra = { latitude: 40.2033, longitude: -8.4103 };
const luz = { latitude: 38.7527, longitude: -9.1847 };
const via = [
  { latitude: 39.9, longitude: -8.3 },
  { latitude: 39.5, longitude: -8.5 },
];

describe('urlDoCaminho', () => {
  it('Apple Maps: source, the points of the chosen road in order, destination, by car', () => {
    expect(urlDoCaminho('apple', coimbra, luz, via)).toBe(
      'https://maps.apple.com/directions?source=40.2033,-8.4103&waypoint=39.9,-8.3&waypoint=39.5,-8.5&destination=38.7527,-9.1847&mode=driving'
    );
  });

  it('Google Maps: the points joined by an encoded «|»', () => {
    expect(urlDoCaminho('google', coimbra, luz, via)).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=40.2033,-8.4103&destination=38.7527,-9.1847&waypoints=39.9,-8.3%7C39.5,-8.5&travelmode=driving'
    );
  });

  it('without points (rides from before), just from the start to the stadium', () => {
    expect(urlDoCaminho('apple', coimbra, luz, [])).toBe(
      'https://maps.apple.com/directions?source=40.2033,-8.4103&destination=38.7527,-9.1847&mode=driving'
    );
    expect(urlDoCaminho('google', coimbra, luz, [])).not.toContain('waypoints');
  });

  it('Waze only takes the destination', () => {
    expect(urlDoCaminho('waze', coimbra, luz, via)).toBe('https://waze.com/ul?ll=38.7527,-9.1847&navigate=yes');
  });
});

describe('urlDirecoes', () => {
  it('Apple Maps on iOS, Google Maps elsewhere', () => {
    expect(urlDirecoes(luz, 'carro', 'ios')).toBe('https://maps.apple.com/?daddr=38.7527,-9.1847&dirflg=d');
    expect(urlDirecoes(luz, 'a-pe', 'android')).toContain('travelmode=walking');
  });
});
