import { describe, it, expect } from 'vitest'
import { compareVersions, isNewerVersion } from './version-utils'

describe('compareVersions', () => {
  it('compares equal versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
    expect(compareVersions('2.1.3', '2.1.3')).toBe(0)
  })

  it('compares major version differences', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0)
  })

  it('compares minor version differences', () => {
    expect(compareVersions('1.2.0', '1.1.0')).toBeGreaterThan(0)
    expect(compareVersions('1.1.0', '1.2.0')).toBeLessThan(0)
  })

  it('compares patch version differences', () => {
    expect(compareVersions('1.0.2', '1.0.1')).toBeGreaterThan(0)
    expect(compareVersions('1.0.1', '1.0.2')).toBeLessThan(0)
  })

  it('handles versions with leading v', () => {
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0)
    expect(compareVersions('1.0.0', 'v1.0.0')).toBe(0)
    expect(compareVersions('v2.0.0', 'v1.0.0')).toBeGreaterThan(0)
  })

  it('handles pre-release versions (ignores pre-release suffix)', () => {
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(0)
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(0)
    expect(compareVersions('2.0.0-rc.1', '1.0.0')).toBeGreaterThan(0)
  })

  it('handles versions with different part counts', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0)
    expect(compareVersions('1.0.0', '1.0')).toBe(0)
    expect(compareVersions('1.0.1', '1.0')).toBeGreaterThan(0)
    expect(compareVersions('1.0', '1.0.1')).toBeLessThan(0)
  })

  it('handles single-part versions', () => {
    expect(compareVersions('2', '1')).toBeGreaterThan(0)
    expect(compareVersions('1', '2')).toBeLessThan(0)
    expect(compareVersions('1', '1.0.0')).toBe(0)
  })

  it('handles invalid version parts gracefully', () => {
    expect(compareVersions('1.x.0', '1.0.0')).toBe(0)
    expect(compareVersions('abc', '0.0.0')).toBe(0)
  })
})

describe('isNewerVersion', () => {
  it('returns true when first version is newer', () => {
    expect(isNewerVersion('2.0.0', '1.0.0')).toBe(true)
    expect(isNewerVersion('1.1.0', '1.0.0')).toBe(true)
    expect(isNewerVersion('1.0.1', '1.0.0')).toBe(true)
  })

  it('returns false when versions are equal', () => {
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false)
    expect(isNewerVersion('v1.0.0', '1.0.0')).toBe(false)
  })

  it('returns false when first version is older', () => {
    expect(isNewerVersion('1.0.0', '2.0.0')).toBe(false)
    expect(isNewerVersion('1.0.0', '1.1.0')).toBe(false)
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(false)
  })
})
