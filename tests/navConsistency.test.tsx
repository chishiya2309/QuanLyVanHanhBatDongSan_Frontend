import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardShell } from '../src/components/dashboard/DashboardShell';
import type { UserProfile } from '../src/types/dashboard';

const root = path.resolve(__dirname, '..');

function readCss(relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

const hostUser: UserProfile = {
  id: 'h-1',
  accountId: 'acc-h1',
  fullName: 'Lê Quang Hưng',
  email: 'host@test.local',
  role: 'HOST',
  managedProperties: [{ id: 'prop_all', name: 'Tất cả cơ sở' }],
};

describe('Navigation size consistency across routes', () => {
  it('keeps 36px desktop nav height in dashboard.css and 44px on mobile open sidebar', () => {
    const dashboardCss = readCss('src/components/dashboard/dashboard.css');
    expect(dashboardCss).toMatch(/\.dash-nav-item\s*\{[^}]*min-height:\s*36px;/s);
    expect(dashboardCss).toMatch(/\.dash-sidebar\.is-mobile-open\s+\.dash-nav-item\s*\{\s*min-height:\s*44px;\s*\}/s);
    expect(dashboardCss).toMatch(/\.dash-sidebar\s*\{[^}]*position:\s*sticky;[^}]*top:\s*52px;/s);
    expect(dashboardCss).toMatch(/\.dash-sidebar\.is-mobile-open\s*\{[^}]*position:\s*static;\s*height:\s*auto;/s);
  });

  it('prevents overlapping select/date inputs in finance filter grid', () => {
    const financeCss = readCss('src/components/reports/finance.css');
    expect(financeCss).toMatch(/\.finance-filter-grid\s*\{[^}]*gap:\s*var\(--space-md\);/s);
    expect(financeCss).toMatch(/\.finance-field\s*:is\(select,\s*input\[type=date\]\)\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*box-sizing:\s*border-box;/s);
  });

  it('has no route-specific min-height overrides in assets.css, hostAccounts.css, or rentalProfile.css', () => {
    const assetsCss = readCss('src/components/assets/assets.css');
    const hostCss = readCss('src/components/admin/hostAccounts.css');
    const rpCss = readCss('src/components/rentalProfile/rentalProfile.css');

    expect(assetsCss).not.toMatch(/\.dashboard-root--assets\s+\.(dash-nav-item|dash-brand|logout-btn)/);
    expect(hostCss).not.toMatch(/\.dashboard-root--admin\s+\.(dash-nav-item|dash-brand|logout-btn)\s*\{[^}]*min-height/);
    expect(rpCss).not.toMatch(/\.dash-nav-item\.rp-nav-item\s*\{[^}]*min-height/);
  });

  it('renders identical sidebar navigation structure when switching between rooms and assets', () => {
    const { rerender } = render(
      <DashboardShell
        user={hostUser}
        showRooms
        roomsActive
        showAssets
        assetsActive={false}
        onLogout={vi.fn()}
        onOpenProfile={vi.fn()}
      >
        <div>Rooms</div>
      </DashboardShell>,
    );

    const navWhenRooms = screen.getByRole('button', { name: /Mặt bằng & Phòng/i });
    const assetWhenRooms = screen.getByRole('button', { name: /Tài sản/i });
    expect(navWhenRooms.className).toContain('dash-nav-item');
    expect(assetWhenRooms.className).toContain('dash-nav-item');

    rerender(
      <DashboardShell
        user={hostUser}
        showRooms
        roomsActive={false}
        showAssets
        assetsActive
        onLogout={vi.fn()}
        onOpenProfile={vi.fn()}
      >
        <div>Assets</div>
      </DashboardShell>,
    );

    const navWhenAssets = screen.getByRole('button', { name: /Mặt bằng & Phòng/i });
    const assetWhenAssets = screen.getByRole('button', { name: /Tài sản/i });
    expect(navWhenAssets.className).toBe('dash-nav-item');
    expect(assetWhenAssets.className).toBe('dash-nav-item is-active');
  });
});
